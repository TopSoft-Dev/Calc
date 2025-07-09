document.addEventListener('DOMContentLoaded', () => {
    // === Elementy DOM ===
    // Kalkulator główny
    const initialAmountEl = document.getElementById('initialAmount');
    const interestRateEl = document.getElementById('interestRate');
    const compoundFrequencyEl = document.getElementById('compoundFrequency');
    const durationEl = document.getElementById('duration');
    const timeUnitEl = document.getElementById('timeUnit');
    const interestRateLabel = document.getElementById('interestRateLabel');
    const resultsSummaryEl = document.getElementById('results-summary');
    const resultsTableBodyEl = document.querySelector('#results-table tbody');
    const chartCanvas = document.getElementById('growthChart').getContext('2d');
    let growthChart;

    // Przelicznik walut
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

    // --- Przelicznik Walut ---
    async function fetchRates() {
        try {
            const response = await fetch('https://api.frankfurter.app/latest?from=USD');
            if (!response.ok) throw new Error('Błąd sieci');
            const data = await response.json();
            exchangeRates = { ...data.rates, 'USD': 1 }; // Dodajemy USD do listy
            performConversion(); // Przelicz po załadowaniu kursów
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


    // --- Główny Kalkulator ---
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
        const initialAmount = parseFloat(initialAmountEl.value);
        const interestRateInput = parseFloat(interestRateEl.value) / 100;
        const compoundFrequency = parseInt(compoundFrequencyEl.value);
        const durationInput = parseInt(durationEl.value);
        const timeUnitMultiplier = parseFloat(timeUnitEl.value);
        const unitText = timeUnitEl.options[timeUnitEl.selectedIndex].text;

        if (isNaN(initialAmount) || isNaN(interestRateInput) || isNaN(durationInput)) {
            resultsSummaryEl.innerHTML = `<p>Proszę wypełnić wszystkie pola poprawnymi danymi.</p>`;
            resultsTableBodyEl.innerHTML = '';
            if (growthChart) growthChart.destroy();
            return;
        }

        const annualInterestRate = interestRateInput * (compoundFrequency);
        const resultsData = [{ period: 'Start', step: 0, amount: initialAmount, profit: 0 }];

        for (let i = 1; i <= durationInput; i++) {
            const totalYears = i * timeUnitMultiplier;
            const amount = initialAmount * Math.pow((1 + annualInterestRate / compoundFrequency), (compoundFrequency * totalYears));
            resultsData.push({
                period: `${unitText.slice(0, -1)} ${i}`,
                step: i,
                amount: amount,
                profit: amount - initialAmount
            });
        }

        const finalResult = resultsData[resultsData.length - 1];
        resultsSummaryEl.innerHTML = `
            <p>Po <strong>${durationInput} ${unitText.toLowerCase()}</strong> Twoja inwestycja będzie warta:</p>
            <h3 style="color: var(--secondary-color); font-size: 2rem;">${formatNumber(finalResult.amount)}</h3>
            <p>Całkowity zysk: <strong>${formatNumber(finalResult.profit)}</strong></p>
        `;

        resultsTableBodyEl.innerHTML = '';
        resultsData.forEach(result => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${result.period}</td>
                <td>${formatNumber(result.amount)}</td>
                <td>${formatNumber(result.profit)}</td>
            `;
            resultsTableBodyEl.appendChild(row);
        });

        // Aktualizacja przelicznika walut
        converterAmountEl.value = finalResult.amount.toFixed(2);
        performConversion();

        // Renderowanie wykresu
        if (growthChart) growthChart.destroy();
        growthChart = new Chart(chartCanvas, {
            type: 'line',
            data: {
                labels: resultsData.map(r => r.step),
                datasets: [{
                    label: 'Wartość inwestycji',
                    data: resultsData.map(r => r.amount),
                    backgroundColor: 'rgba(255, 215, 0, 0.2)',
                    borderColor: 'rgba(255, 215, 0, 1)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(255, 215, 0, 1)',
                    pointBorderColor: '#fff',
                    pointHoverRadius: 7,
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgba(255, 215, 0, 1)',
                    fill: true,
                    tension: 0.4
                }]
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
                    legend: { display: false },
                    tooltip: { callbacks: { label: (context) => `Wartość: ${formatNumber(context.parsed.y)}` } }
                }
            }
        });
    }

    // === Event Listeners ===
    // Główny kalkulator
    [initialAmountEl, interestRateEl, durationEl, compoundFrequencyEl, timeUnitEl].forEach(el => {
        el.addEventListener('input', calculateAndDisplay);
        if (el.tagName === 'SELECT') {
            el.addEventListener('change', calculateAndDisplay);
        }
    });
    compoundFrequencyEl.addEventListener('change', updateUserInterface);

    // Przelicznik walut
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