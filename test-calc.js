const fs = require('fs');
const calc = fs.readFileSync('miniprogram/utils/calculator.js', 'utf8');
eval(calc);

const result = calculatePrice({
  width_mm: 750,
  height_mm: 2000,
  quantity: 1,
  base_price_sqm: 880,
  min_area: 1.5,
  selected_options: [{ price_type: 'fixed', price: 50 }]
});
console.log(result);
