<template>
  <div class="overview-view">
    <div class="header-bar flex-between mb-4">
      <h2 class="view-title">展晨门窗 - 运营大盘数据概览</h2>
    </div>

    <!-- 顶栏统计卡片 -->
    <a-grid :cols="4" :colGap="16" :rowGap="16" class="mb-4">
      <a-grid-item>
        <a-card class="stat-box">
          <a-statistic title="定制订单总数" :value="128" show-group-separator>
            <template #prefix><icon-file-text style="color: #C5A880;" /></template>
            <template #suffix>单</template>
          </a-statistic>
        </a-card>
      </a-grid-item>
      <a-grid-item>
        <a-card class="stat-box">
          <a-statistic title="待复核/待报价" :value="12" show-group-separator>
            <template #prefix><icon-clock-circle style="color: #EAB308;" /></template>
            <template #suffix>单</template>
          </a-statistic>
        </a-card>
      </a-grid-item>
      <a-grid-item>
        <a-card class="stat-box">
          <a-statistic title="排产及制作中" :value="34" show-group-separator>
            <template #prefix><icon-settings style="color: #60A5FA;" /></template>
            <template #suffix>单</template>
          </a-statistic>
        </a-card>
      </a-grid-item>
      <a-grid-item>
        <a-card class="stat-box">
          <a-statistic title="已完成交付" :value="82" show-group-separator>
            <template #prefix><icon-check-circle style="color: #4ADE80;" /></template>
            <template #suffix>单</template>
          </a-statistic>
        </a-card>
      </a-grid-item>
    </a-grid>

    <!-- 运营趋势与热门产品分布 -->
    <a-grid :cols="2" :colGap="16" :rowGap="16">
      <a-grid-item>
        <a-card title="🔥 热门门窗系列选购分布">
          <a-list>
            <a-list-item>
              <div class="flex-between w-full">
                <span>展晨108热桥级系统断桥铝窗</span>
                <a-tag color="gold">45% 客户首选</a-tag>
              </div>
            </a-list-item>
            <a-list-item>
              <div class="flex-between w-full">
                <span>展晨极简16窄边重型推拉门</span>
                <a-tag color="blue">30% 客户首选</a-tag>
              </div>
            </a-list-item>
            <a-list-item>
              <div class="flex-between w-full">
                <span>展晨120超静音三玻两腔系统窗</span>
                <a-tag color="green">15% 客户首选</a-tag>
              </div>
            </a-list-item>
            <a-list-item>
              <div class="flex-between w-full">
                <span>展晨尊享断桥阳光房系统</span>
                <a-tag color="purple">10% 客户首选</a-tag>
              </div>
            </a-list-item>
          </a-list>
        </a-card>
      </a-grid-item>

      <a-grid-item>
        <a-card title="📍 门店信息与服务标准">
          <div class="store-details">
            <p><strong>品牌旗舰店：</strong> 展晨门窗 (湖北仙桃恒迪建材市场2期14栋1-107)</p>
            <p><strong>官方咨询热线：</strong> <span style="color: #C5A880; font-weight: bold;">13545941637</span></p>
            <p><strong>品牌资质背书：</strong> 20+年专业门窗制造经验 / 50000+ 成功案例 / ISO9001 质量管理体系认证</p>
            <p><strong>算价规则基准：</strong> 默认起步计费面积 1.5 ㎡，支持按平米/按件/固定金额选配加价与商家现场复核改价。</p>
          </div>
        </a-card>
      </a-grid-item>
    </a-grid>
  </div>
</template>

<script setup>
</script>

<style scoped>
.view-title { font-size: 20px; font-weight: 700; margin: 0; }
.flex-between { display: flex; justify-content: space-between; align-items: center; }
.w-full { width: 100%; }
.mb-4 { margin-bottom: 16px; }
.stat-box { border-radius: 12px; }
.store-details p { font-size: 14px; line-height: 1.8; color: #4e5969; }
</style>
