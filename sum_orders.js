const wsKey = 'BZSMWP6E43Z8H41ACW75XU5XAQRAQG9B';
const baseUrl = 'http://localhost/prestashop/api';

async function main() {
  const url = `${baseUrl}/orders?display=[id,current_state,total_paid,total_paid_tax_excl,payment]&limit=1000`;
  const resp = await fetch(url, {
    headers: {
      Authorization: 'Basic ' + Buffer.from(wsKey + ':').toString('base64'),
    },
  });
  if (!resp.ok) {
    console.error('Error fetching orders:', resp.statusText);
    return;
  }
  const xml = await resp.text();
  
  // Use a regex to extract orders for simplicity in Node
  const orderRegex = /<order>[\s\S]*?<\/order>/g;
  const matches = xml.match(orderRegex) || [];
  
  let totalHt = 0;
  let totalTtc = 0;
  let count = 0;
  
  const ordersInfo = [];
  
  for (const match of matches) {
    const id = match.match(/<id>(?:<!\[CDATA\[)?(\d+)/)?.[1];
    const currentState = match.match(/<current_state[^>]*>(?:<!\[CDATA\[)?(\d+)/)?.[1];
    const totalPaid = parseFloat(match.match(/<total_paid>(?:<!\[CDATA\[)?([\d.]+)/)?.[1] || 0);
    const totalPaidTaxExcl = parseFloat(match.match(/<total_paid_tax_excl>(?:<!\[CDATA\[)?([\d.]+)/)?.[1] || 0);
    const payment = match.match(/<payment>(?:<!\[CDATA\[)?([^\]<]+)/)?.[1] || '';
    
    // Filter logic identical to DashboardPage:
    // Exclude state 1 (Dans le panier) and 3/6 (Annulé)
    const isExcluded = currentState === '1' || currentState === '3' || currentState === '6' || payment.toLowerCase().includes('panier') || payment.toLowerCase().includes('annul');
    
    if (!isExcluded) {
      totalHt += totalPaidTaxExcl;
      totalTtc += totalPaid;
      count++;
      ordersInfo.push({ id, currentState, totalPaid, totalPaidTaxExcl, payment });
    }
  }
  
  console.log(`Matched orders count: ${count}`);
  console.log(`Sum HT: ${totalHt.toFixed(6)}`);
  console.log(`Sum TTC: ${totalTtc.toFixed(6)}`);
  console.log('Sample orders info (first 5 and last 5):');
  console.log('First 5:', ordersInfo.slice(0, 5));
  console.log('Last 5:', ordersInfo.slice(-5));
}

main().catch(console.error);
