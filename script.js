document.addEventListener('DOMContentLoaded', () => {
    // === Elementy DOM ===
    const initialAmountEl = document.getElementById('initialAmount');
    const interestRateEl = document.getElementById('interestRate');
    const monthlyDepositEl = document.getElementById('monthlyDeposit');
    const compoundFrequencyEl = document.getElementById('compoundFrequency');
    const durationEl = document.getElementById('duration');
    const timeUnitEl = document.getElementById('timeUnit');
    const interestRateLabel = document.getElementById('interestRateLabel');
    const resultsSummaryEl = document.getElementById('results-summary');
    const resultsTableBodyEl = document.querySelector('#results-table tbody');
    const chartCanvas = document.getElementById('growthChart').getContext('2d');
    let growthChart;

    const converterAmountEl = document.getElementById('converterAmount');
    const fromCurrencyEl = document.getElementById('fromCurrency');
    const toCurrencyEl = document.getElementById('toCurrency');
    const converterResultEl = document.getElementById('converter-result');

    // === Stan Aplikacji ===
    let exchangeRates = {};

    // === Konfiguracja ===
    const timeUnitOptions = {
        '365': { 'Dni': 1 / 365, 'Miesiące': 1 / 12, 'Lata': 1 },
        '12': { 'Miesiące': 1 / 12, 'Lata': 1 },
        '4': { 'Kwartaly': 1 / 4, 'Lata': 1 },
        '1': { 'Lata': 1 }
    };
    const interestRateLabels = {
        '365': 'Dzienne oprocentowanie (%)',
        '12': 'Miesięczne oprocentowanie (%)',
        '4': 'Kwartalne oprocentowanie (%)',
        '1': 'Roczne oprocentowanie (%)'
    };

    // === Funkcje ===

    async function fetchRates() {
        try {
            const response = await fetch('https://api.frankfurter.app/latest?from=USD');
            if (!response.ok) throw new Error('Błąd sieci');
            const data = await response.json();
            exchangeRates = { ...data.rates, 'USD': 1 };
            performConversion();
        } catch (error) {
            converterResultEl.innerHTML = `<p style="color: #ff5555;">Błąd ładowania kursów</p>`;
            console.error("Błąd API walut:", error);
        }
    }

    function performConversion() {
        const amount = parseFloat(converterAmountEl.value);
        const fromCurrency = fromCurrencyEl.value;
        const toCurrency = toCurrencyEl.value;

        if (isNaN(amount) || !exchangeRates[fromCurrency] || !exchangeRates[toCurrency]) {
            converterResultEl.innerHTML = `<p>...</p>`;
            return;
        }

        const amountInUSD = amount / exchangeRates[fromCurrency];
        const convertedAmount = amountInUSD * exchangeRates[toCurrency];

        converterResultEl.innerHTML = `<p>${formatNumber(convertedAmount)} ${toCurrency}</p>`;
    }

    function updateUserInterface() {
        const frequency = compoundFrequencyEl.value;
        interestRateLabel.textContent = interestRateLabels[frequency];
        const currentUnitOptions = timeUnitOptions[frequency];
        const currentVal = timeUnitEl.value;
        timeUnitEl.innerHTML = '';
        for (const unit in currentUnitOptions) {
            const option = document.createElement('option');
            option.value = currentUnitOptions[unit];
            option.textContent = unit;
            timeUnitEl.appendChild(option);
        }
        if (currentVal && Object.values(currentUnitOptions).includes(parseFloat(currentVal))) {
            timeUnitEl.value = currentVal;
        } else if (frequency !== '365') {
            timeUnitEl.value = 1;
        }
    }

    function formatNumber(num) {
        return num.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
    }

    function calculateAndDisplay() {
        const initialAmount = parseFloat(initialAmountEl.value) || 0;
        const periodicInterestRate = parseFloat(interestRateEl.value) / 100 || 0;
        const periodicDeposit = parseFloat(monthlyDepositEl.value) || 0;
        const compoundFrequency = parseInt(compoundFrequencyEl.value);
        const durationInput = parseInt(durationEl.value);
        const timeUnitMultiplier = parseFloat(timeUnitEl.value);
        const unitText = timeUnitEl.options[timeUnitEl.selectedIndex].text;

        if (isNaN(initialAmount) || isNaN(periodicInterestRate) || isNaN(durationInput)) {
            resultsSummaryEl.innerHTML = `<p>Proszę wypełnić wszystkie pola poprawnymi danymi.</p>`;
            resultsTableBodyEl.innerHTML = '';
            if (growthChart) growthChart.destroy();
            return;
        }

        const resultsData = [{ period: 'Start', step: 0, amount: initialAmount, profit: 0, amountWithoutDeposits: initialAmount }];

        for (let i = 1; i <= durationInput; i++) {
            const totalYears = i * timeUnitMultiplier;
            const n = compoundFrequency * totalYears;
            const r = periodicInterestRate;
            let amount;
            let amountWithoutDeposits;

            if (r === 0) {
                amount = initialAmount + (periodicDeposit * n);
                amountWithoutDeposits = initialAmount;
            } else {
                const futureValueInitial = initialAmount * Math.pow((1 + r), n);
                const futureValueDeposits = periodicDeposit * ((Math.pow((1 + r), n) - 1) / r);
                amount = futureValueInitial + futureValueDeposits;
                amountWithoutDeposits = futureValueInitial;
            }
            
            const totalInvested = initialAmount + (periodicDeposit * n);
            const profit = amount - totalInvested;

            resultsData.push({
                period: `${unitText.slice(0, -1)} ${i}`,
                step: i,
                amount: amount,
                profit: profit,
                amountWithoutDeposits: amountWithoutDeposits
            });
        }

        const finalResult = resultsData[resultsData.length - 1];
        const finalProfitFormatted = finalResult.profit >= 0 ? `+${formatNumber(finalResult.profit)}` : formatNumber(finalResult.profit);
        const profitClass = finalResult.profit >= 0 ? 'profit' : 'loss';

        resultsSummaryEl.innerHTML = `
            <p>Po <strong>${durationInput} ${unitText.toLowerCase()}</strong> Twoja inwestycja będzie warta:</p>
            <h3 style="color: var(--secondary-color); font-size: 2rem;">${formatNumber(finalResult.amount)}</h3>
            <p>Całkowity zysk: <strong class="${profitClass}">${finalProfitFormatted}</strong></p>
        `;

        resultsTableBodyEl.innerHTML = '';
        resultsData.forEach(result => {
            const row = document.createElement('tr');
            const profitDisplay = result.period === 'Start' 
                ? `<td>${formatNumber(result.profit)}</td>`
                : result.profit >= 0 
                    ? `<td class="profit">+${formatNumber(result.profit)}</td>` 
                    : `<td class="loss">${formatNumber(result.profit)}</td>`;
            
            row.innerHTML = `
                <td>${result.period}</td>
                <td>${formatNumber(result.amount)}</td>
                ${profitDisplay}
            `;
            resultsTableBodyEl.appendChild(row);
        });

        converterAmountEl.value = finalResult.amount.toFixed(2);
        performConversion();

        // Renderowanie wykresu
        if (growthChart) growthChart.destroy();

        const chartDatasets = [];
        const hasDeposits = periodicDeposit > 0;

        if (hasDeposits) {
            // Dwie linie: z wpłatami (zielona) i bez (żółta)
            chartDatasets.push({
                label: 'Wartość z wpłatami',
                data: resultsData.map(r => r.amount),
                backgroundColor: 'rgba(0, 255, 0, 0.2)',
                borderColor: 'rgba(0, 128, 0, 1)',
                borderWidth: 2,
                pointBackgroundColor: 'rgba(0, 128, 0, 1)',
                pointBorderColor: '#fff',
                pointHoverRadius: 7,
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgba(0, 128, 0, 1)',
                fill: true,
                tension: 0.4
            });
            chartDatasets.push({
                label: 'Wartość bez wpłat',
                data: resultsData.map(r => r.amountWithoutDeposits),
                backgroundColor: 'rgba(255, 255, 0, 0.2)',
                borderColor: 'rgba(255, 255, 0, 1)',
                borderWidth: 2,
                pointBackgroundColor: 'rgba(255, 255, 0, 1)',
                pointBorderColor: '#fff',
                pointHoverRadius: 7,
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgba(255, 255, 0, 1)',
                fill: true,
                tension: 0.4
            });
        } else {
            // Jedna linia: tylko inwestycja (żółta)
            chartDatasets.push({
                label: 'Wartość inwestycji',
                data: resultsData.map(r => r.amount),
                backgroundColor: 'rgba(255, 255, 0, 0.2)',
                borderColor: 'rgba(255, 255, 0, 1)',
                borderWidth: 2,
                pointBackgroundColor: 'rgba(255, 255, 0, 1)',
                pointBorderColor: '#fff',
                pointHoverRadius: 7,
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgba(255, 255, 0, 1)',
                fill: true,
                tension: 0.4
            });
        }

        growthChart = new Chart(chartCanvas, {
            type: 'line',
            data: {
                labels: resultsData.map(r => r.step),
                datasets: chartDatasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { bottom: 10 } },
                scales: {
                    y: { ticks: { color: '#e0e0e0' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
                    x: {
                        title: { display: true, text: unitText, color: '#e0e0e0' },
                        ticks: { color: '#e0e0e0' },
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: { 
                        display: hasDeposits, // Pokazuj legendę tylko gdy są dwie linie
                        labels: {
                            color: '#e0e0e0'
                        }
                    },
                    tooltip: { 
                        callbacks: { 
                            label: (context) => {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                label += `${formatNumber(context.parsed.y)}`;
                                return label;
                            }
                        } 
                    }
                }
            }
        });
    }

    // === Event Listeners ===
    [initialAmountEl, interestRateEl, monthlyDepositEl, durationEl, compoundFrequencyEl, timeUnitEl].forEach(el => {
        el.addEventListener('input', calculateAndDisplay);
        if (el.tagName === 'SELECT') {
            el.addEventListener('change', calculateAndDisplay);
        }
    });
    compoundFrequencyEl.addEventListener('change', updateUserInterface);

    [converterAmountEl, fromCurrencyEl, toCurrencyEl].forEach(el => {
        el.addEventListener('input', performConversion);
        if (el.tagName === 'SELECT') {
            el.addEventListener('change', performConversion);
        }
    });

    // === Inicjalizacja ===
    updateUserInterface();
    calculateAndDisplay();
    fetchRates();
});