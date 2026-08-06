<template>
  <div class="overview-view">
    <div class="header-bar flex-between mb-3">
      <h2 class="view-title">展晨门窗 - 运营大盘数据概览</h2>
      <a-button type="outline" size="small" @click="initCharts">
        <template #icon><icon-refresh /></template>
        刷新图表
      </a-button>
    </div>

    <!-- 顶栏 KPI 统计卡片 -->
    <a-grid :cols="4" :colGap="14" :rowGap="14" class="mb-3">
      <a-grid-item>
        <a-card class="stat-box" hoverable>
          <a-statistic title="定制订单总数" :value="128" show-group-separator>
            <template #prefix
              ><icon-file-text style="color: #c5a880"
            /></template>
            <template #suffix>单</template>
          </a-statistic>
        </a-card>
      </a-grid-item>
      <a-grid-item>
        <a-card class="stat-box" hoverable>
          <a-statistic title="待复核/待报价" :value="12" show-group-separator>
            <template #prefix
              ><icon-clock-circle style="color: #eab308"
            /></template>
            <template #suffix>单</template>
          </a-statistic>
        </a-card>
      </a-grid-item>
      <a-grid-item>
        <a-card class="stat-box" hoverable>
          <a-statistic title="排产及制作中" :value="34" show-group-separator>
            <template #prefix
              ><icon-settings style="color: #60a5fa"
            /></template>
            <template #suffix>单</template>
          </a-statistic>
        </a-card>
      </a-grid-item>
      <a-grid-item>
        <a-card class="stat-box" hoverable>
          <a-statistic title="已完成交付" :value="82" show-group-separator>
            <template #prefix
              ><icon-check-circle style="color: #4ade80"
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
              <strong>品牌旗舰店：</strong> 展晨门窗
              (湖北仙桃恒迪建材市场2期14栋1-107)
            </p>
            <p>
              <strong>官方咨询热线：</strong>
              <span style="color: #b89768; font-weight: bold">13545941637</span>
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

const lineChartRef = ref(null);
const pieChartRef = ref(null);
const barChartRef = ref(null);

let lineChartInstance = null;
let pieChartInstance = null;
let barChartInstance = null;

// 监听日间/夜间模式切换自动更新图表色彩
const getIsDark = () => document.body.getAttribute("arco-theme") === "dark";

const initCharts = () => {
  const isDark = getIsDark();
  const textColor = isDark ? "#E2E8F0" : "#1D2129";
  const axisLineColor = isDark ? "rgba(255, 255, 255, 0.15)" : "#E5E6EB";
  const splitLineColor = isDark ? "rgba(255, 255, 255, 0.06)" : "#F2F3F5";

  // 1. 初始化近7天走势折线图 (Legend 置于右上角防止与 X 轴重叠)
  if (lineChartRef.value) {
    if (!lineChartInstance) {
      lineChartInstance = echarts.init(lineChartRef.value);
    }
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
        data: ["07-30", "07-31", "08-01", "08-02", "08-03", "08-04", "08-05"],
        axisLine: { lineStyle: { color: axisLineColor } },
        axisLabel: { color: textColor, fontSize: 11 },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: splitLineColor } },
        axisLabel: { color: textColor, fontSize: 11 },
      },
      series: [
        {
          name: "新建定制订单",
          type: "line",
          smooth: true,
          data: [8, 12, 15, 11, 18, 22, 26],
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
          data: [5, 8, 10, 9, 14, 16, 20],
          itemStyle: { color: "#4ADE80" },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(74, 222, 128, 0.25)" },
              { offset: 1, color: "rgba(74, 222, 128, 0.02)" },
            ]),
          },
        },
      ],
    });
  }

  // 2. 初始化饼图 (热门门窗系列选购分布)
  if (pieChartRef.value) {
    if (!pieChartInstance) {
      pieChartInstance = echarts.init(pieChartRef.value);
    }
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
          data: [
            {
              value: 45,
              name: "108热桥级断桥铝窗",
              itemStyle: { color: "#C5A880" },
            },
            {
              value: 30,
              name: "极简16重型推拉门",
              itemStyle: { color: "#60A5FA" },
            },
            {
              value: 15,
              name: "120超静音三玻窗",
              itemStyle: { color: "#4ADE80" },
            },
            {
              value: 10,
              name: "尊享断桥阳光房",
              itemStyle: { color: "#A855F7" },
            },
          ],
        },
      ],
    });
  }

  // 3. 初始化柱状图 (订单阶段流转分布)
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
        data: ["待复核/报价", "排产制作中", "准备待提货", "完成交付"],
        axisLine: { lineStyle: { color: axisLineColor } },
        axisLabel: { color: textColor, fontSize: 11 },
      },
      yAxis: {
        type: "value",
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
              value: 12,
              itemStyle: { color: "#EAB308", borderRadius: [6, 6, 0, 0] },
            },
            {
              value: 34,
              itemStyle: { color: "#60A5FA", borderRadius: [6, 6, 0, 0] },
            },
            {
              value: 18,
              itemStyle: { color: "#C5A880", borderRadius: [6, 6, 0, 0] },
            },
            {
              value: 82,
              itemStyle: { color: "#4ADE80", borderRadius: [6, 6, 0, 0] },
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
  setTimeout(() => {
    initCharts();
  }, 100);
  window.addEventListener("resize", handleResize);

  // 监听主题属性变化
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
