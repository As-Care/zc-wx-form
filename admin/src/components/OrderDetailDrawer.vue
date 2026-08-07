<template>
  <a-drawer
    :visible="visible"
    @update:visible="val => emit('update:visible', val)"
    title="订单全量规格与核算详情"
    :width="780"
    :footer="false"
  >
    <div v-if="order">
      <!-- 头部状态 banner -->
      <div class="status-banner mb-4">
        <div class="flex-between">
          <div>
            <span style="font-size: 12px; color: var(--color-text-3);">订单编号：</span>
            <strong style="font-size: 16px; color: var(--color-text-1);">{{ order.order_no }}</strong>
          </div>
          <span class="custom-status-tag" :style="getStatusStyle(order.status)" style="font-size: 14px; padding: 2px 10px;">
            {{ getStatusText(order.status) }}
          </span>
        </div>
        <div style="font-size: 12px; color: var(--color-text-3); margin-top: 6px;">
          下单时间：{{ order.created_at || '暂无时间' }}
        </div>
      </div>

      <!-- 👤 客户基本信息 -->
      <a-card title="👤 客户基本信息" class="mb-4" size="small">
        <a-descriptions :column="2" border size="small">
          <a-descriptions-item label="客户姓名">{{ order.customer_name }}</a-descriptions-item>
          <a-descriptions-item label="联系电话">{{ order.customer_phone }}</a-descriptions-item>
          <a-descriptions-item label="安装详细地址" :span="2">{{ order.install_address }}</a-descriptions-item>
          <a-descriptions-item label="订单创建者">{{ order.creator_name || order.customer_name }}</a-descriptions-item>
          <a-descriptions-item label="创建方式">{{ order.creator_type === 'admin' ? '后台管理员代客创建' : '微信客户本人创建' }}</a-descriptions-item>
        </a-descriptions>
      </a-card>

      <!-- 📐 门窗多套定制规格明细拆解 -->
      <a-card title="📐 门窗多套定制规格明细拆解" class="mb-4" size="small">
        <div
          v-for="(item, idx) in order.items"
          :key="idx"
          class="item-spec-box mb-3"
        >
          <div class="flex-between mb-2">
            <a-tag color="arcoblue" style="font-weight: 600;">{{ item.label || `套系 ${idx + 1}` }}</a-tag>
            <strong style="color: #b89768; font-size: 16px;">小计：¥ {{ item.item_subtotal || item.billed_area * item.base_price_sqm }}</strong>
          </div>

          <h4 style="margin: 4px 0 8px 0; font-size: 15px; color: var(--color-text-1);">{{ item.product_name }}</h4>
          <div style="font-size: 13px; color: var(--color-text-2); margin-bottom: 8px;">
            规格尺寸：<strong>{{ item.width_mm }} × {{ item.height_mm }} mm</strong>
            &nbsp;|&nbsp;
            实际面积：<strong>{{ item.area_sqm || ((item.width_mm * item.height_mm) / 1000000).toFixed(2) }} ㎡</strong>
            &nbsp;|&nbsp;
            计费起步面积：<strong>{{ item.billed_area }} ㎡</strong>
          </div>

          <!-- 选配明细卡片 -->
          <div class="options-detail-panel mb-3" v-if="getItemOptions(item).length > 0">
            <div class="panel-title">选配升级配置明细：</div>
            <div v-for="(opt, oIdx) in getItemOptions(item)" :key="oIdx" class="option-row" style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">
              <span class="dot">•</span>
              <span class="group-label" style="color: var(--color-text-2);">{{ opt.groupTitle || opt.group || opt.group_name || '选配' }}：</span>
              <img v-if="opt.image_url" :src="opt.image_url" style="width: 20px; height: 20px; object-fit: cover; border-radius: 3px; border: 1px solid var(--color-border);" />
              <span class="opt-name" style="color: var(--color-text-1);">{{ opt.option_name || opt.name || opt.id }}</span>
              <span class="opt-price" v-if="opt.priceText" style="color: #ff7d00; margin-left: 4px;">{{ opt.priceText }}</span>
            </div>
          </div>
          <div v-else class="options-detail-panel mb-3" style="color: var(--color-text-3); font-size: 12px; font-style: italic;">
            暂无特殊选配升级项 (使用基础标配)
          </div>

          <!-- 1. 单套现场照片 -->
          <div v-if="getItemSceneImages(item, order).length > 0" style="margin-top: 10px; margin-bottom: 8px;">
            <div style="font-size: 12px; color: var(--color-text-2); font-weight: 600; margin-bottom: 4px;">本套现场环境照片：</div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <a-image
                v-for="(imgUrl, imgIdx) in getItemSceneImages(item, order)"
                :key="imgIdx"
                :src="imgUrl"
                width="80"
                height="80"
                style="object-fit: cover; border-radius: 6px; border: 1px solid var(--color-border);"
              />
            </div>
          </div>

          <!-- 2. 单套现场备注 -->
          <div v-if="getItemRemark(item, order)" class="site-remark-box">
            <strong style="color: #d46b08;">本套现场备注：</strong>{{ getItemRemark(item, order) }}
          </div>
        </div>
      </a-card>

      <!-- 💰 订单核算金额明细汇总 -->
      <a-card title="💰 订单核算金额明细拆解" class="mb-4" size="small">
        <div class="price-summary-box">
          <div class="price-row flex-between">
            <span>基础平米总费用：</span>
            <span>¥ {{ order.base_amount }}</span>
          </div>
          <div class="price-row flex-between">
            <span>选配升级加价：</span>
            <span>¥ {{ order.extra_amount || 0 }}</span>
          </div>
          <div class="price-row flex-between" v-if="order.special_charges_amount > 0">
            <span style="color: #ff7d00;">商家追加特殊费用 (如吊装/旧窗拆除)：</span>
            <span style="color: #ff7d00; font-weight: bold;">+ ¥ {{ order.special_charges_amount }}</span>
          </div>
          <a-divider style="margin: 10px 0;" />
          <div class="price-row flex-between" style="font-size: 18px;">
            <strong style="color: var(--color-text-1);">订单核算最终总金额：</strong>
            <strong style="color: #C5A880; font-size: 20px;">¥ {{ order.final_amount }}</strong>
          </div>
        </div>
      </a-card>

      <!-- 📝 商家备注 -->
      <a-card title="📝 商家备注" size="small" v-if="order.admin_remark">
        <div style="font-size: 13px; color: var(--color-text-1); background: var(--color-fill-2); padding: 12px; border-radius: 8px; border: 1px dashed var(--color-border);">
          {{ order.admin_remark }}
        </div>
      </a-card>

      <div style="margin-top: 24px; display: flex; justify-content: flex-end;">
        <a-button type="primary" size="large" @click="emit('update:visible', false)">关闭详情</a-button>
      </div>
    </div>
  </a-drawer>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';

const props = defineProps({
  visible: { type: Boolean, default: false },
  order: { type: Object, default: () => null }
});

const emit = defineEmits(['update:visible']);

const getStatusText = (status) => {
  const map = {
    'pending_review': '待复核',
    'producing': '生产中',
    'installing': '待提货',
    'completed': '已完成',
    'cancelled': '已取消'
  };
  return map[status] || status;
};

const getStatusStyle = (status) => {
  const map = {
    'pending_review': { backgroundColor: '#e2e8f0', color: '#64748b', borderColor: '#94a3b8' },
    'producing': { backgroundColor: '#f97316', color: '#ffffff', borderColor: '#f97316' },
    'installing': { backgroundColor: '#eab308', color: '#ffffff', borderColor: '#eab308' },
    'completed': { backgroundColor: '#10b981', color: '#ffffff', borderColor: '#10b981' },
    'cancelled': { backgroundColor: '#f1f5f9', color: '#94a3b8', borderColor: '#cbd5e1' }
  };
  return map[status] || map['pending_review'];
};

const getItemRemark = (item, order) => {
  if (item && (item.remark || item.customer_remark || item.note)) {
    return item.remark || item.customer_remark || item.note;
  }
  return order?.customer_remark || '';
};

const getItemSceneImages = (item, order) => {
  let imgs = item?.scene_images || item?.scene_image || item?.images || item?.photos;
  if (!imgs) {
    imgs = order?.scene_images;
  }
  if (!imgs) return [];
  if (Array.isArray(imgs)) return imgs;
  if (typeof imgs === 'string') {
    try {
      const parsed = JSON.parse(imgs);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {}
    return imgs.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
};

const getItemOptions = (item) => {
  if (!item) return [];
  let summary = [];
  if (item.options_summary && Array.isArray(item.options_summary) && item.options_summary.length > 0) {
    summary = item.options_summary;
  } else if (item.options_summary_json) {
    try {
      summary = JSON.parse(item.options_summary_json);
    } catch (e) {}
  }
  if (Array.isArray(summary) && summary.length > 0) {
    return summary.map(opt => ({
      ...opt,
      groupTitle: opt.groupTitle || opt.group_name || opt.group || '选配',
      option_name: opt.option_name || opt.name || opt.id || '常规配置'
    }));
  }

  let selMap = {};
  if (item.selected_options_json) {
    try { selMap = JSON.parse(item.selected_options_json); } catch (e) {}
  } else if (item.selected_options) {
    selMap = typeof item.selected_options === 'string' ? JSON.parse(item.selected_options) : item.selected_options;
  }
  if (selMap && typeof selMap === 'object') {
    return Object.keys(selMap).map(grp => {
      const rawVal = selMap[grp];
      const optName = typeof rawVal === 'string' ? rawVal : (rawVal && (rawVal.option_name || rawVal.name || rawVal.id));
      return {
        groupTitle: grp,
        option_name: optName || '常规配置',
        priceText: ''
      };
    });
  }
  return [];
};
</script>

<style scoped>
.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.mb-4 {
  margin-bottom: 16px;
}

.mb-3 {
  margin-bottom: 12px;
}

.mb-2 {
  margin-bottom: 8px;
}

.status-banner {
  background: rgba(197, 168, 128, 0.08);
  padding: 16px;
  border-radius: 12px;
  border: 1px solid rgba(197, 168, 128, 0.2);
}

body[arco-theme='dark'] .status-banner {
  background: rgba(197, 168, 128, 0.12);
  border-color: rgba(197, 168, 128, 0.3);
}

.item-spec-box {
  background: rgba(0, 0, 0, 0.02);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 16px;
}

body[arco-theme='dark'] .item-spec-box {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.12);
}

.options-detail-panel {
  background: rgba(197, 168, 128, 0.06);
  border-radius: 8px;
  padding: 10px 14px;
  margin-top: 10px;
}

body[arco-theme='dark'] .options-detail-panel {
  background: rgba(197, 168, 128, 0.1);
}

.panel-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-1);
  margin-bottom: 8px;
}

.site-remark-box {
  margin-top: 12px;
  padding: 10px;
  background: rgba(212, 107, 8, 0.05);
  border-left: 3px solid #d46b08;
  border-radius: 4px;
  font-size: 13px;
  color: var(--color-text-2);
}

.price-summary-box {
  background: var(--color-fill-1);
  padding: 16px;
  border-radius: 8px;
}

.price-row {
  margin-bottom: 8px;
  color: var(--color-text-2);
}

.custom-status-tag {
  display: inline-block;
  border-radius: 4px;
  font-weight: 500;
  text-align: center;
}
</style>
