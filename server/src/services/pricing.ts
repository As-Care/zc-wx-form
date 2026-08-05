/**
 * 展晨门窗算价与起步面积计算引擎
 */

export interface PricingInput {
  width_mm: number;
  height_mm: number;
  quantity?: number;
  base_price_sqm: number;
  min_area?: number; // 默认 1.5 平米起步
  selected_options?: Array<{
    price_type: 'per_sqm' | 'per_item' | 'fixed';
    price: number;
  }>;
  special_charges?: Array<{
    name: string;
    amount: number;
  }>;
}

export interface PricingResult {
  actual_area: number;     // 实际计算面积 (㎡)
  billed_area: number;     // 计费面积 (含起步底线 ㎡)
  base_amount: number;     // 基础平米费用 (元)
  extra_amount: number;    // 选配加价总额 (元)
  special_charges_amount: number; // 特殊收费/调价总额 (元)
  subtotal: number;        // 单项/订单总计 (元)
}

export function calculateDoorWindowPrice(input: PricingInput): PricingResult {
  const qty = input.quantity && input.quantity > 0 ? input.quantity : 1;
  const minArea = input.min_area !== undefined ? input.min_area : 1.5;

  // 1. 实际单扇面积 (宽 mm * 高 mm / 1,000,000)
  const singleActualArea = Number(((input.width_mm * input.height_mm) / 1000000).toFixed(2));
  
  // 2. 计费单扇面积 (若低于起步面积，按起步面积计算)
  const singleBilledArea = Math.max(singleActualArea, minArea);

  const totalActualArea = Number((singleActualArea * qty).toFixed(2));
  const totalBilledArea = Number((singleBilledArea * qty).toFixed(2));

  // 3. 基础费用
  const baseAmount = Number((totalBilledArea * input.base_price_sqm).toFixed(2));

  // 4. 选配项加价计算
  let extraAmount = 0;
  if (input.selected_options && Array.isArray(input.selected_options)) {
    for (const opt of input.selected_options) {
      if (opt.price_type === 'per_sqm') {
        extraAmount += totalBilledArea * opt.price;
      } else if (opt.price_type === 'per_item') {
        extraAmount += opt.price * qty;
      } else if (opt.price_type === 'fixed') {
        extraAmount += opt.price;
      }
    }
  }
  extraAmount = Number(extraAmount.toFixed(2));

  // 5. 特殊收费加价计算 (如吊装、拆旧、异形开孔)
  let specialChargesAmount = 0;
  if (input.special_charges && Array.isArray(input.special_charges)) {
    for (const charge of input.special_charges) {
      specialChargesAmount += charge.amount || 0;
    }
  }
  specialChargesAmount = Number(specialChargesAmount.toFixed(2));

  // 6. 最终总计
  const subtotal = Number((baseAmount + extraAmount + specialChargesAmount).toFixed(2));

  return {
    actual_area: totalActualArea,
    billed_area: totalBilledArea,
    base_amount: baseAmount,
    extra_amount: extraAmount,
    special_charges_amount: specialChargesAmount,
    subtotal: subtotal
  };
}
