const mathFloaters = ['∑ x²', 'f(x) = eˣ', 'π ≈ 3.14', '∇ AI', '01 / 10', 'Σ data', 'P(A|B)', '∞'];

if (!document.querySelector('.about-react-page') && !document.querySelector('.math-floaters')) {
    const layer = document.createElement('div');
    layer.className = 'math-floaters';
    layer.setAttribute('aria-hidden', 'true');
    layer.innerHTML = mathFloaters.map((formula, index) => `
    <span class="math-floater" style="--floater-index:${index}">
      <span class="math-formula">${formula}</span><i></i>
    </span>
  `).join('');
    document.body.prepend(layer);
}
