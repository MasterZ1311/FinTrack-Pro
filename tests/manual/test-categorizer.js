import { ruleBasedCategorize } from '../../src/services/categorizer.js';

const samples = [
  "UPI/CR/123456789/Swiggy Technologies/HDFC",
  "POS 1234 15AUG26 ZOMATO PVT LTD",
  "NEFT-HDFC0001234-Amazon Retail",
  "IMPS-SBIN000123-Flipkart Internet",
  "UPI/DR/12345/Uber Rides/HDFC",
  "POS 5678 OLA CABS",
  "UPI/CR/123/IRCTC TICKETS/SBI",
  "NETBANKING MAKE MY TRIP INDIA",
  "AUTO DEBIT NETFLIX ENTERTAINMENT",
  "UPI/DR/345/Spotify AB/ICICI",
  "POS 9012 APOLLO PHARMACY",
  "NEFT-ICIC000111-Fortis Healthcare",
  "UPI/DR/111/Jio Prepaid/PAYTM",
  "AUTO PAY AIRTEL MOBILE",
  "UPI/DR/222/Starbucks Coffee/AXIS",
  "POS 3456 MCDONALDS",
  "NEFT-AXIS000999-Myntra Designs",
  "UPI/CR/333/Paytm Wallet/HDFC",
  "POS 7890 BSNL BROADBAND",
  "UPI/DR/444/Cleartrip Pvt Ltd/ICICI"
];

console.log("Rule-Based Categorizer Test:");
console.log("-".repeat(50));

samples.forEach((sample, i) => {
  const result = ruleBasedCategorize(sample);
  const resultStr = result ? `Category: ${result.category} (Confidence: ${result.confidence}, Method: ${result.method})` : "Uncategorized";
  console.log(`${i+1}. ${sample}`);
  console.log(`   -> ${resultStr}`);
  console.log("-".repeat(50));
});
