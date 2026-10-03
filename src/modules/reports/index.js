import db from '../../db.js';
import * as xlsx from 'xlsx';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export async function render(container) {
    container.innerHTML = `
        <div class="reports-container" style="padding: 2rem; max-width: 800px; margin: 0 auto;">
            <div class="glass-card" style="padding: 2.5rem; border-radius: 16px; display: flex; flex-direction: column; gap: 2rem;">
                <div style="text-align: center;">
                    <h2 style="margin-top: 0; margin-bottom: 0.5rem; font-size: 2rem; font-weight: 700; background: linear-gradient(135deg, var(--primary-color, #2563eb), var(--secondary-color, #7c3aed)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Reports Engine</h2>
                    <p style="color: var(--text-secondary, #6b7280); margin: 0; font-size: 1.1rem;">Generate and export your financial statements</p>
                </div>

                <form id="report-form" style="display: flex; flex-direction: column; gap: 1.5rem;">
                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                        <label for="report-type" style="font-weight: 600; font-size: 0.95rem; color: var(--text-primary, #1f2937);">Report Type</label>
                        <select id="report-type" style="padding: 0.875rem; border-radius: 10px; border: 1px solid var(--border-color, #e5e7eb); background: var(--input-bg, #f9fafb); color: var(--text-color, #111827); font-size: 1rem; outline: none; transition: all 0.2s; cursor: pointer;">
                            <option value="monthly">Monthly Statement</option>
                            <option value="annual">Annual Tax Summary</option>
                        </select>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                        <label for="report-period" style="font-weight: 600; font-size: 0.95rem; color: var(--text-primary, #1f2937);">Period</label>
                        <input type="month" id="report-period" required style="padding: 0.875rem; border-radius: 10px; border: 1px solid var(--border-color, #e5e7eb); background: var(--input-bg, #f9fafb); color: var(--text-color, #111827); font-size: 1rem; outline: none; transition: all 0.2s;">
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                        <label for="report-account" style="font-weight: 600; font-size: 0.95rem; color: var(--text-primary, #1f2937);">Account</label>
                        <select id="report-account" style="padding: 0.875rem; border-radius: 10px; border: 1px solid var(--border-color, #e5e7eb); background: var(--input-bg, #f9fafb); color: var(--text-color, #111827); font-size: 1rem; outline: none; transition: all 0.2s; cursor: pointer;">
                            <option value="all">All Accounts</option>
                        </select>
                    </div>

                    <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                        <button type="button" id="btn-pdf" class="btn btn-primary" style="flex: 1; padding: 1rem; border-radius: 10px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; border: none; background: #ef4444; color: white; transition: background 0.2s, transform 0.1s;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            Download PDF
                        </button>
                        <button type="button" id="btn-excel" class="btn btn-secondary" style="flex: 1; padding: 1rem; border-radius: 10px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; border: none; background: #10b981; color: white; transition: background 0.2s, transform 0.1s;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h2"></path><path d="M8 17h2"></path><path d="M14 13h2"></path><path d="M14 17h2"></path></svg>
                            Download Excel
                        </button>
                    </div>
                </form>
            </div>
        </div>
        
        <!-- Hidden container for PDF rendering -->
        <div id="pdf-template-container" style="position: absolute; left: -9999px; top: 0; width: 850px; background: white; color: black; padding: 60px; box-sizing: border-box; display: none;"></div>
    `;

    // Add button hover effects manually if generic CSS is missing
    const pdfBtn = container.querySelector('#btn-pdf');
    const excelBtn = container.querySelector('#btn-excel');
    
    pdfBtn.onmouseover = () => pdfBtn.style.background = '#dc2626';
    pdfBtn.onmouseout = () => pdfBtn.style.background = '#ef4444';
    pdfBtn.onmousedown = () => pdfBtn.style.transform = 'scale(0.98)';
    pdfBtn.onmouseup = () => pdfBtn.style.transform = 'scale(1)';

    excelBtn.onmouseover = () => excelBtn.style.background = '#059669';
    excelBtn.onmouseout = () => excelBtn.style.background = '#10b981';
    excelBtn.onmousedown = () => excelBtn.style.transform = 'scale(0.98)';
    excelBtn.onmouseup = () => excelBtn.style.transform = 'scale(1)';

    // Form interactions
    const reportTypeSelect = container.querySelector('#report-type');
    const periodInput = container.querySelector('#report-period');
    
    reportTypeSelect.addEventListener('change', (e) => {
        if (e.target.value === 'annual') {
            // Can't just select year in input[type="month"] but we can let them pick any month in that year
            periodInput.title = "Select any month in the target year";
        }
    });

    // Populate accounts
    const accountSelect = container.querySelector('#report-account');
    try {
        const accounts = await db.getAll('accounts');
        accounts.forEach(acc => {
            const opt = document.createElement('option');
            opt.value = acc.id;
            opt.textContent = acc.name || acc.bankName || acc.id;
            accountSelect.appendChild(opt);
        });
    } catch (err) {
        console.error("Failed to load accounts for reports", err);
    }

    // Default to current month
    const today = new Date();
    periodInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    // Event listeners
    pdfBtn.addEventListener('click', () => generateReport('pdf'));
    excelBtn.addEventListener('click', () => generateReport('excel'));

    async function generateReport(format) {
        const type = reportTypeSelect.value;
        const period = periodInput.value;
        const accountId = accountSelect.value;

        if (!period) {
            alert('Please select a period.');
            return;
        }

        // Fetch transactions
        let transactions = [];
        try {
            transactions = await db.getAll('transactions');
        } catch (err) {
            console.error("Failed to load transactions", err);
            alert("Could not load transactions.");
            return;
        }
        
        // Filter out split parent records to avoid double-counting
        transactions = transactions.filter(t => !t.isSplit);

        // Filter by account
        if (accountId !== 'all') {
            transactions = transactions.filter(t => t.accountId === accountId);
        }

        // Filter by period
        if (type === 'monthly') {
            transactions = transactions.filter(t => t.date && t.date.startsWith(period));
        } else if (type === 'annual') {
            const year = period.split('-')[0];
            transactions = transactions.filter(t => t.date && t.date.startsWith(year));
        }

        if (transactions.length === 0) {
            alert('No transactions found for the selected criteria.');
            return;
        }

        // Sort chronologically
        transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Generate summary data
        const summary = {};
        transactions.forEach(t => {
            const cat = t.category || 'Uncategorized';
            if (!summary[cat]) {
                summary[cat] = { income: 0, expense: 0 };
            }
            const amount = parseFloat(t.amount) || 0;
            // Depending on how DB stores it, some apps store type=expense, some just use negative amount. We'll handle both.
            if (t.type === 'income' || (t.type !== 'expense' && amount > 0)) {
                summary[cat].income += amount;
            } else {
                summary[cat].expense += Math.abs(amount);
            }
        });

        if (format === 'excel') {
            exportExcel(transactions, summary, period, type);
        } else if (format === 'pdf') {
            await exportPDF(transactions, summary, period, type, accountId);
        }
    }

    function exportExcel(transactions, summary, period, type) {
        try {
            // Guard spreadsheet row bounds (max 10,000 rows to prevent memory exhaustion)
            const boundedTransactions = transactions.slice(0, 10000);

            // Sheet 1: Summary
            const summaryData = Object.keys(summary).map(cat => ({
                Category: cat,
                Income: summary[cat].income,
                Expense: summary[cat].expense,
                Net: summary[cat].income - summary[cat].expense
            }));
            const summarySheet = xlsx.utils.json_to_sheet(summaryData);

            // Sheet 2: Transactions
            const txData = boundedTransactions.map(t => ({
                Date: t.date,
                Description: t.description || '',
                Category: t.category || '',
                Type: t.type || '',
                Amount: parseFloat(t.amount) || 0,
                Account: t.accountId || ''
            }));
            const txSheet = xlsx.utils.json_to_sheet(txData);

            const wb = xlsx.utils.book_new();
            xlsx.utils.book_append_sheet(wb, summarySheet, 'Summary');
            xlsx.utils.book_append_sheet(wb, txSheet, 'Transactions');

            const title = type === 'monthly' ? period : period.split('-')[0];
            const filename = `Expense_Report_${title}.xlsx`;
            xlsx.writeFile(wb, filename);
        } catch (err) {
            console.error('Failed to export Excel report:', err);
            alert('Failed to generate Excel report.');
        }
    }

    async function exportPDF(transactions, summary, period, type, accountId) {
        const templateContainer = container.querySelector('#pdf-template-container');
        templateContainer.style.display = 'block'; // Make it visible but off-screen
        
        let totalIncome = 0;
        let totalExpense = 0;
        
        const summaryRows = Object.keys(summary).map(cat => {
            totalIncome += summary[cat].income;
            totalExpense += summary[cat].expense;
            return `
                <tr>
                    <td style="padding: 12px 10px; border-bottom: 1px solid #f0f0f0; color: #333;">${cat}</td>
                    <td style="padding: 12px 10px; border-bottom: 1px solid #f0f0f0; text-align: right; color: #059669; font-weight: 500;">$${summary[cat].income.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                    <td style="padding: 12px 10px; border-bottom: 1px solid #f0f0f0; text-align: right; color: #dc2626; font-weight: 500;">$${summary[cat].expense.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                </tr>
            `;
        }).join('');

        const txRows = transactions.slice(0, 100).map(t => {
            const amount = parseFloat(t.amount || 0);
            const isExpense = t.type === 'expense' || amount < 0;
            const displayAmt = Math.abs(amount).toLocaleString('en-US', {minimumFractionDigits: 2});
            const color = isExpense ? '#dc2626' : '#059669';
            return `
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #f0f0f0; color: #555;">${new Date(t.date).toLocaleDateString()}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #f0f0f0; color: #333;">${t.description || 'N/A'}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #f0f0f0; color: #555;">${t.category || 'N/A'}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #f0f0f0; text-align: right; color: ${color}; font-weight: 500;">${isExpense ? '-' : '+'}$${displayAmt}</td>
                </tr>
            `;
        }).join('');

        let extraNotice = transactions.length > 100 ? `<p style="font-size: 13px; color: #888; text-align: center; margin-top: 30px; font-style: italic;">* Only the first 100 transactions are shown to conserve space. Please use the Excel export for a complete list.</p>` : '';

        const title = type === 'monthly' ? `Monthly Statement` : `Annual Tax Summary`;
        const dateDisplay = type === 'monthly' ? period : period.split('-')[0];
        
        let accName = 'All Accounts';
        if (accountId !== 'all') {
            const opt = accountSelect.querySelector(`option[value="${accountId}"]`);
            if (opt) accName = opt.textContent;
        }
        
        templateContainer.innerHTML = `
            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111; background: #fff; padding: 20px;">
                <!-- Header -->
                <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #111; padding-bottom: 25px; margin-bottom: 40px;">
                    <div>
                        <h1 style="margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -0.5px; color: #111;">FinTrack<span style="color: #2563eb;">Pro</span></h1>
                        <p style="margin: 8px 0 0; font-size: 15px; color: #666; font-weight: 500;">Official Financial Report</p>
                    </div>
                    <div style="text-align: right;">
                        <h2 style="margin: 0; font-size: 22px; font-weight: 700; color: #111;">${title}</h2>
                        <p style="margin: 8px 0 0; font-size: 16px; color: #444; font-weight: 500;">Period: ${dateDisplay}</p>
                        <p style="margin: 4px 0 0; font-size: 14px; color: #666;">Account: ${accName}</p>
                        <p style="margin: 4px 0 0; font-size: 13px; color: #999;">Generated: ${new Date().toLocaleDateString()}</p>
                    </div>
                </div>

                <!-- Summary Section -->
                <div style="margin-bottom: 50px;">
                    <h3 style="margin: 0 0 15px 0; font-size: 20px; font-weight: 700; color: #111; display: flex; align-items: center; gap: 8px;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
                        Executive Summary
                    </h3>
                    <div style="border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background-color: #f9fafb;">
                                    <th style="padding: 14px 12px; border-bottom: 2px solid #e5e7eb; text-align: left; font-weight: 600; color: #374151; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Category</th>
                                    <th style="padding: 14px 12px; border-bottom: 2px solid #e5e7eb; text-align: right; font-weight: 600; color: #374151; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Income</th>
                                    <th style="padding: 14px 12px; border-bottom: 2px solid #e5e7eb; text-align: right; font-weight: 600; color: #374151; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Expense</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${summaryRows}
                            </tbody>
                            <tfoot>
                                <tr style="background-color: #f9fafb;">
                                    <th style="padding: 16px 12px; border-top: 2px solid #e5e7eb; text-align: left; font-weight: 700; font-size: 16px; color: #111;">Total</th>
                                    <th style="padding: 16px 12px; border-top: 2px solid #e5e7eb; text-align: right; color: #059669; font-weight: 700; font-size: 16px;">$${totalIncome.toLocaleString('en-US', {minimumFractionDigits: 2})}</th>
                                    <th style="padding: 16px 12px; border-top: 2px solid #e5e7eb; text-align: right; color: #dc2626; font-weight: 700; font-size: 16px;">$${totalExpense.toLocaleString('en-US', {minimumFractionDigits: 2})}</th>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    
                    <div style="margin-top: 15px; text-align: right; font-size: 18px; font-weight: 700;">
                        Net Change: <span style="color: ${totalIncome - totalExpense >= 0 ? '#059669' : '#dc2626'}">${totalIncome - totalExpense >= 0 ? '+' : ''}$${(totalIncome - totalExpense).toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                    </div>
                </div>

                <!-- Transactions Section -->
                <div>
                    <h3 style="margin: 0 0 15px 0; font-size: 20px; font-weight: 700; color: #111; display: flex; align-items: center; gap: 8px;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                        Transaction Details
                    </h3>
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <thead>
                            <tr style="background-color: #f9fafb;">
                                <th style="padding: 12px 10px; border-bottom: 2px solid #e5e7eb; border-top: 1px solid #e5e7eb; text-align: left; font-weight: 600; color: #374151;">Date</th>
                                <th style="padding: 12px 10px; border-bottom: 2px solid #e5e7eb; border-top: 1px solid #e5e7eb; text-align: left; font-weight: 600; color: #374151;">Description</th>
                                <th style="padding: 12px 10px; border-bottom: 2px solid #e5e7eb; border-top: 1px solid #e5e7eb; text-align: left; font-weight: 600; color: #374151;">Category</th>
                                <th style="padding: 12px 10px; border-bottom: 2px solid #e5e7eb; border-top: 1px solid #e5e7eb; text-align: right; font-weight: 600; color: #374151;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${txRows}
                        </tbody>
                    </table>
                    ${extraNotice}
                </div>
                
                <!-- Footer -->
                <div style="margin-top: 60px; border-top: 1px solid #eaeaea; padding-top: 20px; text-align: center; color: #999; font-size: 12px;">
                    FinTrack Pro — This is an automatically generated report. Please consult a tax professional for official tax advice.
                </div>
            </div>
        `;

        try {
            // Render the original HTML elements with modern CSS
            // Give it time to render in DOM
            await new Promise(resolve => setTimeout(resolve, 200));

            const canvas = await html2canvas(templateContainer, {
                scale: 2, // High resolution
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                windowWidth: 850 // Match template width
            });
            const imgData = canvas.toDataURL('image/jpeg', 1.0); // Use JPEG for better performance with jsPDF
            
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            // If the content is longer than one page, jsPDF addImage will stretch it or truncate it if we aren't careful
            // For a robust implementation, we should paginate or just add it on a long single page.
            // A4 page height is ~297mm.
            // Let's just fit it all in the document, allowing it to stretch if needed, or add new pages.
            // Since this is a simple implementation, we'll draw it once.
            
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            
            const filenameTitle = type === 'monthly' ? period : period.split('-')[0];
            pdf.save(`Expense_Report_${filenameTitle}.pdf`);
        } catch (error) {
            console.error("PDF generation error", error);
            alert("Failed to generate PDF. Check console for details.");
        } finally {
            templateContainer.style.display = 'none';
            templateContainer.innerHTML = '';
        }
    }
}
