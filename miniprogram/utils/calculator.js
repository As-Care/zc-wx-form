/**
 * 前端实时尺寸与选配算价器引擎
 */

function calculatePrice(params) {
  const width = Number(params.width_mm) || 0;
  const height = Number(params.height_mm) || 0;
  const qty = Number(params.quantity) || 1;
  const basePrice = Number(params.base_price_sqm) || 680;
  const minArea = params.min_area !== undefined ? Number(params.min_area) : 1.5;

  // 实际面积 (㎡)
  const singleActualArea = Number(((width * height) / 1000000).toFixed(2));
  // 计费面积 (低于起步按起步算)
  const singleBilledArea = Math.max(singleActualArea, minArea);

  const totalActualArea = Number((singleActualArea * qty).toFixed(2));
  const totalBilledArea = Number((singleBilledArea * qty).toFixed(2));

  // 基础平米费
  const baseAmount = Number((totalBilledArea * basePrice).toFixed(2));

  // 选配加价
  let extraAmount = 0;
  if (params.selected_options && Array.isArray(params.selected_options)) {
    for (const opt of params.selected_options) {
      const price = Number(opt.price) || 0;
      if (opt.price_type === 'per_sqm') {
        extraAmount += totalBilledArea * price;
      } else if (opt.price_type === 'per_item') {
        extraAmount += price * qty;
      } else if (opt.price_type === 'fixed') {
        extraAmount += price;
      }
    }
  }
  extraAmount = Number(extraAmount.toFixed(2));

  // 预估总价
  const totalPrice = Number((baseAmount + extraAmount).toFixed(2));

  return {
    actualArea: totalActualArea,
    billedArea: totalBilledArea,
    baseAmount: baseAmount,
    extraAmount: extraAmount,
    totalPrice: totalPrice,
    isMinAreaTriggered: singleActualArea < minArea
  };
}

module.exports = {
  calculatePrice
};
