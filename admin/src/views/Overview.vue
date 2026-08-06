<template>
  <div class="overview-view">
    <div class="header-bar flex-between mb-3">
      <h2 class="view-title">展晨门窗 - 运营大盘数据概览</h2>
      <a-button type="outline" size="small" @click="fetchRealStats">
        <template #icon><icon-refresh /></template>
        刷新图表数据
      </a-button>
    </div>

    <!-- 顶栏 KPI 统计卡片 (真实数据库统计) -->
    <a-grid :cols="4" :colGap="14" :rowGap="14" class="mb-3">
      <a-grid-item>
        <a-card class="stat-box" hoverable>
          <a-statistic title="定制订单总数" :value="statsData.totalOrders" show-group-separator>
            <template #prefix
              ><icon-file-text style="color: #c5a880"
            /></template>
            <template #suffix>单</template>
          </a-statistic>
        </a-card>
      </a-grid-item>
      <a-grid-item>
        <a-card class="stat-box" hoverable>
          <a-statistic title="待复核" :value="statsData.pendingReviewCount" show-group-separator>
            <template #prefix
              ><icon-clock-circle style="color: #cbd5e1"
            /></template>
            <template #suffix>单</template>
          </a-statistic>
        </a-card>
      </a-grid-item>
      <a-grid-item>
        <a-card class="stat-box" hoverable>
          <a-statistic title="生产中" :value="statsData.producingCount" show-group-separator>
            <template #prefix
              ><icon-settings style="color: #f97316"
            /></template>
            <template #suffix>单</template>
          </a-statistic>
        </a-card>
      </a-grid-item>
      <a-grid-item>
        <a-card class="stat-box" hoverable>
          <a-statistic title="已完成" :value="statsData.completedCount" show-group-separator>
            <template #prefix
              ><icon-check-circle style="color: #10b981"
            /></template>
            <template #suffix>单</template>
          </a-statistic>
        </a-card>
      </a-grid-item>
    </a-grid>

    <!-- 核心 ECharts 图表展示区 第一排 -->
    <a-grid :cols="2" :colGap="14" :rowGap="14" class="mb-3">
      <!-- 近7天订单与交付趋势线图 -->
      <a-grid-item>
        <a-card title="📈 近 7 天订单成交与交付走势">
          <div ref="lineChartRef" class="chart-container"></div>
        </a-card>
      </a-grid-item>

      <!-- 热门门窗系列选购分布饼图 -->
      <a-grid-item>
        <a-card title="📊 热门门窗系列选购分布占比">
          <div ref="pieChartRef" class="chart-container"></div>
        </a-card>
      </a-grid-item>
    </a-grid>

    <!-- 第二排 图表与门店标准 -->
    <a-grid :cols="2" :colGap="14" :rowGap="14">
      <!-- 订单阶段状态流转柱状图 -->
      <a-grid-item>
        <a-card title="🔄 订单流转阶段分布">
          <div ref="barChartRef" class="chart-container"></div>
        </a-card>
      </a-grid-item>

      <!-- 门店服务标准与信息 -->
      <a-grid-item>
        <a-card title="📍 门店信息与服务标准">
          <div class="store-details">
            <p>
              <strong>品牌旗舰店：</strong> {{ storeInfo.name || '展晨门窗' }}
              ({{ storeInfo.address || '湖北省仙桃市恒迪建材市场2期14栋1-107' }})
            </p>
            <p>
              <strong>官方咨询热线：</strong>
              <span style="color: #b89768; font-weight: bold">{{ storeInfo.phone || '13545941637' }}</span>
            </p>
            <p>
              <strong>品牌资质背书：</strong> 20+年专业门窗制造经验 / 50000+
              成功案例 / ISO9001 质量管理体系认证
            </p>
            <p>
              <strong>算价规则基准：</strong> 默认起步计费面积 1.5
              ㎡，支持按平米/按件/固定金额选配加价与商家现场复核改价。
            </p>
          </div>
        </a-card>
      </a-grid-item>
    </a-grid>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import * as echarts from "echarts";

const API_BASE = 'https://zc-api.carelife.top';

const lineChartRef = ref(null);
const pieChartRef = ref(null);
const barChartRef = ref(null);

let lineChartInstance = null;
let pieChartInstance = null;
let barChartInstance = null;

const statsData = ref({
  totalOrders: 0,
  pendingReviewCount: 0,
  producingCount: 0,
  installingCount: 0,
  completedCount: 0,
  totalRevenue: 0,
  recentTrends: {
    dates: [],
    createdCounts: [],
    completedCounts: []
  },
  productDistribution: [],
  statusDistribution: []
});

const storeInfo = ref({
  name: '展晨门窗',
  phone: '13545941637',
  address: '湖北省仙桃市恒迪建材市场2期14栋1-107'
});

const fetchRealStats = async () => {
  try {
    const res = await fetch(`${API_BASE}/api/admin/stats`);
    const data = await res.json();
    if (data.success && data.data) {
      statsData.value = data.data;
    }
  } catch (e) {}

  try {
    const resStore = await fetch(`${API_BASE}/api/admin/config/store`);
    const dataStore = await resStore.json();
    if (dataStore.success && dataStore.data) {
      storeInfo.value = dataStore.data;
    }
  } catch (e) {}

  initCharts();
};

const getIsDark = () => document.body.getAttribute("arco-theme") === "dark";

const initCharts = () => {
  const isDark = getIsDark();
  const textColor = isDark ? "#E2E8F0" : "#1D2129";
  const axisLineColor = isDark ? "rgba(255, 255, 255, 0.15)" : "#E5E6EB";
  const splitLineColor = isDark ? "rgba(255, 255, 255, 0.06)" : "#F2F3F5";

  // 1. 近 7 天折线图 (真实数据)
  if (lineChartRef.value) {
    if (!lineChartInstance) {
      lineChartInstance = echarts.init(lineChartRef.value);
    }
    const dates = statsData.value.recentTrends?.dates || ["08-01", "08-02", "08-03", "08-04", "08-05", "08-06", "08-07"];
    const created = statsData.value.recentTrends?.createdCounts || [0, 0, 0, 0, 0, 0, 0];
    const completed = statsData.value.recentTrends?.completedCounts || [0, 0, 0, 0, 0, 0, 0];

    lineChartInstance.setOption({
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross" },
      },
      legend: {
        top: "0%",
        right: "2%",
        data: ["新建定制订单", "完成交付订单"],
        textStyle: { color: textColor, fontSize: 12 },
      },
      grid: {
        top: "18%",
        left: "3%",
        right: "4%",
        bottom: "4%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: dates,
        axisLine: { lineStyle: { color: axisLineColor } },
        axisLabel: { color: textColor, fontSize: 11 },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        splitLine: { lineStyle: { color: splitLineColor } },
        axisLabel: { color: textColor, fontSize: 11 },
      },
      series: [
        {
          name: "新建定制订单",
          type: "line",
          smooth: true,
          data: created,
          itemStyle: { color: "#C5A880" },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(197, 168, 128, 0.35)" },
              { offset: 1, color: "rgba(197, 168, 128, 0.02)" },
            ]),
          },
        },
        {
          name: "完成交付订单",
          type: "line",
          smooth: true,
          data: completed,
          itemStyle: { color: "#10b981" },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(16, 185, 129, 0.25)" },
              { offset: 1, color: "rgba(16, 185, 129, 0.02)" },
            ]),
          },
        },
      ],
    });
  }

  // 2. 热门选购占比饼图 (真实数据)
  if (pieChartRef.value) {
    if (!pieChartInstance) {
      pieChartInstance = echarts.init(pieChartRef.value);
    }

    const pieColors = ["#C5A880", "#f97316", "#10b981", "#eab308", "#8b5cf6", "#ec4899"];
    const rawPieData = statsData.value.productDistribution || [];
    const pieData = rawPieData.length > 0 ? rawPieData.map((item, idx) => ({
      name: item.name,
      value: item.value || 0,
      itemStyle: { color: pieColors[idx % pieColors.length] }
    })) : [
      { name: "108热桥级断桥铝窗", value: 1, itemStyle: { color: "#C5A880" } }
    ];

    pieChartInstance.setOption({
      tooltip: {
        trigger: "item",
        formatter: "{b}: {c}单 ({d}%)",
      },
      legend: {
        orient: "vertical",
        left: "0%",
        top: "center",
        textStyle: { color: textColor, fontSize: 11 },
      },
      series: [
        {
          name: "选购占比",
          type: "pie",
          radius: ["45%", "75%"],
          center: ["66%", "50%"],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 8,
            borderColor: isDark ? "#1a1d24" : "#ffffff",
            borderWidth: 2,
          },
          label: { show: false },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: "bold",
              color: textColor,
            },
          },
          labelLine: { show: false },
          data: pieData,
        },
      ],
    });
  }

  // 3. 订单阶段分布柱状图 (真实数据与规范色彩与小程序标准文案)
  if (barChartRef.value) {
    if (!barChartInstance) {
      barChartInstance = echarts.init(barChartRef.value);
    }
    barChartInstance.setOption({
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
      },
      grid: {
        top: "12%",
        left: "3%",
        right: "4%",
        bottom: "4%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: ["待复核", "生产中", "待提货", "已完成"],
        axisLine: { lineStyle: { color: axisLineColor } },
        axisLabel: { color: textColor, fontSize: 11 },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        splitLine: { lineStyle: { color: splitLineColor } },
        axisLabel: { color: textColor, fontSize: 11 },
      },
      series: [
        {
          name: "订单笔数",
          type: "bar",
          barWidth: "36%",
          data: [
            {
              value: statsData.value.pendingReviewCount || 0,
              itemStyle: { color: "#e2e8f0", borderColor: "#94a3b8", borderWidth: 1, borderRadius: [6, 6, 0, 0] },
            },
            {
              value: statsData.value.producingCount || 0,
              itemStyle: { color: "#f97316", borderRadius: [6, 6, 0, 0] },
            },
            {
              value: statsData.value.installingCount || 0,
              itemStyle: { color: "#eab308", borderRadius: [6, 6, 0, 0] },
            },
            {
              value: statsData.value.completedCount || 0,
              itemStyle: { color: "#10b981", borderRadius: [6, 6, 0, 0] },
            },
          ],
        },
      ],
    });
  }
};

const handleResize = () => {
  lineChartInstance?.resize();
  pieChartInstance?.resize();
  barChartInstance?.resize();
};

onMounted(() => {
  fetchRealStats();
  window.addEventListener("resize", handleResize);

  const observer = new MutationObserver(() => {
    initCharts();
  });
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ["arco-theme"],
  });
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleResize);
  lineChartInstance?.dispose();
  pieChartInstance?.dispose();
  barChartInstance?.dispose();
});
</script>

<style scoped>
.overview-view {
  display: flex;
  flex-direction: column;
}
.view-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
}
.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.mb-3 {
  margin-bottom: 12px;
}
.stat-box {
  border-radius: 12px;
}
.chart-container {
  height: 210px;
  width: 100%;
}
.store-details {
  height: 210px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  box-sizing: border-box;
}
.store-details p {
  font-size: 13px;
  line-height: 1.8;
  color: #4e5969;
  margin: 4px 0;
}

body[arco-theme="dark"] .store-details p {
  color: #a6b1c2;
}
</style>
