<template>
  <div class="products-view">
    <div class="header-bar flex-between mb-4">
      <h2 class="view-title">门窗商品方案管理</h2>
      <a-space>
        <a-button
          :disabled="selectedProductIds.length === 0"
          :loading="batchStatusSaving"
          @click="batchUpdateStatus(1)"
        >批量上架</a-button>
        <a-button
          status="warning"
          :disabled="selectedProductIds.length === 0"
          :loading="batchStatusSaving"
          @click="batchUpdateStatus(0)"
        >批量下架</a-button>
        <a-button type="primary" @click="openProductModal">
          <template #icon><icon-plus /></template>
          新建门窗商品
        </a-button>
      </a-space>
    </div>

    <!-- 搜索与多维度筛选面板 -->
    <a-card class="search-panel mb-4" size="small">
      <a-form :model="searchForm" auto-label-width>
        <a-row :gutter="[12, 16]">
          <a-col :xs="24" :sm="12" :md="7">
            <a-form-item label="所属分类 (可多选)">
              <a-select
                v-model="searchForm.categories"
                placeholder="请选择一个或多个分类"
                multiple
                allow-clear
                style="width: 100%"
              >
                <a-option v-for="cat in categories" :key="cat" :value="cat">
                  {{ cat }}
                </a-option>
              </a-select>
            </a-form-item>
          </a-col>

          <a-col :xs="24" :sm="12" :md="7">
            <a-form-item label="商品名称/描述">
              <a-input
                v-model="searchForm.name"
                placeholder="输入名称或关键字模糊搜索"
                allow-clear
                style="width: 100%"
                @keyup.enter="handleSearch"
              />
            </a-form-item>
          </a-col>

          <a-col :xs="24" :sm="12" :md="6">
            <a-form-item hide-label>
              <a-space>
                <a-button type="primary" @click="handleSearch">
                  <template #icon><icon-search /></template>
                  查询
                </a-button>
                <a-button @click="handleReset">
                  <template #icon><icon-refresh /></template>
                  重置
                </a-button>
              </a-space>
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-card>

    <!-- 门窗商品数据表格 -->
    <a-table
      :data="products"
      :loading="tableLoading"
      :pagination="{ pageSize: 10 }"
      :row-selection="rowSelection"
      border
      row-key="id"
      class="no-wrap-header-table"
      @selection-change="handleProductSelectionChange"
    >
      <template #columns>
        <a-table-column title="商品主图" :width="110">
          <template #cell="{ record }">
            <a-image
              v-if="record.cover_image"
              :src="record.cover_image"
              width="64"
              height="64"
              fit="cover"
              style="
                border-radius: 8px;
                border: 1px solid #e5e6eb;
                cursor: pointer;
              "
              show-loader
            />
            <span v-else style="color: #c9cdd4; font-size: 12px">暂无主图</span>
          </template>
        </a-table-column>

        <a-table-column title="商品名称" data-index="name" :width="220">
          <template #cell="{ record }">
            <div>
              <strong>{{ record.name }}</strong>
              <div style="font-size: 12px; color: #86909c; margin-top: 4px">
                {{ record.description }}
              </div>
            </div>
          </template>
        </a-table-column>

        <a-table-column
          title="所属分类"
          data-index="category_name"
          :width="150"
        >
          <template #cell="{ record }">
            <a-tag class="soft-cat-tag">{{
              record.category_name || "门窗分类"
            }}</a-tag>
          </template>
        </a-table-column>

        <a-table-column
          title="基础平米单价"
          data-index="base_price_sqm"
          :width="140"
        >
          <template #cell="{ record }">
            <strong style="color: #b89768; font-size: 15px"
              >¥ {{ record.base_price_sqm }} / ㎡</strong
            >
          </template>
        </a-table-column>

        <a-table-column title="起步计费面积" data-index="min_area" :width="120">
          <template #cell="{ record }"> {{ record.min_area }} ㎡ </template>
        </a-table-column>

        <a-table-column title="选配加价规则" :width="160">
          <template #cell="{ record }">
            <a-tag
              color="arcoblue"
              style="cursor: pointer"
              @click="openOptionsDrawer(record)"
            >
              <template #icon><icon-settings /></template>
              {{ record.options ? record.options.length : 0 }} 项规则 (点击配置)
            </a-tag>
          </template>
        </a-table-column>

        <a-table-column title="状态" :width="130">
          <template #cell="{ record }">
            <a-switch
              v-model="record.is_active"
              :checked-value="1"
              :unchecked-value="0"
              :loading="statusLoadingIds.has(record.id)"
              @change="(val) => handleStatusChange(record, val)"
            >
              <template #checked>已上架</template>
              <template #unchecked>已下架</template>
            </a-switch>
          </template>
        </a-table-column>

        <a-table-column title="热门推荐" :width="130">
          <template #cell="{ record }">
            <a-switch
              :model-value="record.is_hot === 1"
              :loading="hotLoadingIds.has(record.id)"
              @change="(val) => handleHotChange(record, val)"
            >
              <template #checked>热门</template>
              <template #unchecked>普通</template>
            </a-switch>
          </template>
        </a-table-column>

        <a-table-column title="操作" :width="250">
          <template #cell="{ record }">
            <div
              style="
                display: flex;
                flex-direction: row;
                align-items: center;
                white-space: nowrap;
                gap: 6px;
              "
            >
              <a-button
                type="outline"
                size="small"
                @click="editProduct(record)"
              >
                编辑
              </a-button>
              <a-button
                type="outline"
                size="small"
                status="warning"
                @click="openOptionsDrawer(record)"
              >
                选配规则
              </a-button>
              <a-button
                type="outline"
                size="small"
                :loading="copyingProductIds.has(record.id)"
                @click="copyProduct(record)"
              >
                复制
              </a-button>
            </div>
          </template>
        </a-table-column>
      </template>
    </a-table>

    <!-- 新建/修改商品 Modal -->
    <a-modal
      v-model:visible="modalVisible"
      title="配置门窗商品与主图"
      :on-before-ok="handleBeforeSaveProduct"
      width="860px"
    >
      <a-form :model="form" layout="vertical">
        <a-row :gutter="24">
          <!-- 左侧栏：基础信息 -->
          <a-col :span="12">
            <a-form-item
              field="name"
              label="商品名称"
              required
              :rules="[{ required: true, message: '商品名称为必填项' }]"
            >
              <a-input
                v-model="form.name"
                placeholder="请输入商品全称（必填）"
              />
            </a-form-item>

            <a-form-item label="上下架状态" required>
              <a-switch
                v-model="form.is_active"
                :checked-value="1"
                :unchecked-value="0"
              >
                <template #checked>已上架</template>
                <template #unchecked>已下架</template>
              </a-switch>
            </a-form-item>

            <a-form-item
              field="category_name"
              label="所属分类"
              required
              :rules="[{ required: true, message: '请选择所属分类' }]"
            >
              <a-select
                v-model="form.category_name"
                placeholder="请选择分类（必选）"
              >
                <a-option v-for="cat in categories" :key="cat" :value="cat">
                  {{ cat }}
                </a-option>
              </a-select>
            </a-form-item>

            <a-form-item label="简短描述说明">
              <a-textarea
                v-model="form.description"
                placeholder="高隔音高隔热，适合高层住宅与阳台封窗"
                :auto-size="{ minRows: 3, maxRows: 5 }"
              />
            </a-form-item>

            <a-form-item label="基础平米单价 (元/㎡)">
              <a-input-number
                v-model="form.base_price_sqm"
                placeholder="如 680"
              />
            </a-form-item>
          </a-col>

          <!-- 右侧栏：图片与计费配置 -->
          <a-col :span="12">
            <a-form-item
              field="cover_image"
              label="商品封面主图"
              required
              :rules="[{ required: true, message: '请上传商品封面主图' }]"
            >
              <div class="luxury-upload-card">
                <a-spin :loading="uploading" tip="正在上传中">
                  <div v-if="form.cover_image" class="cover-preview-box">
                    <img :src="form.cover_image" class="cover-img" />
                    <div class="cover-hover-mask">
                      <a-upload
                        action="https://zc-api.carelife.top/api/upload"
                        :show-file-list="false"
                        @before-upload="onBeforeUpload"
                        @success="onCoverUploadSuccess"
                        @error="onCoverUploadError"
                        style="display: inline-block"
                      >
                        <template #upload-button>
                          <span class="mask-icon" title="更换主图">
                            <icon-camera />
                          </span>
                        </template>
                      </a-upload>
                      <span
                        class="mask-icon mask-icon-delete ml-2"
                        title="删除主图"
                        @click.stop="form.cover_image = ''"
                      >
                        <icon-delete />
                      </span>
                    </div>
                  </div>
                  <a-upload
                    v-else
                    action="https://zc-api.carelife.top/api/upload"
                    :show-file-list="false"
                    @before-upload="onBeforeUpload"
                    @success="onCoverUploadSuccess"
                    @error="onCoverUploadError"
                  >
                    <template #upload-button>
                      <div class="upload-dropzone">
                        <div class="upload-icon-circle">
                          <icon-plus style="font-size: 22px; color: #c5a880" />
                        </div>
                        <span class="upload-title">点击上传图片</span>
                        <span class="upload-sub"
                          >支持 PNG / JPG / WEBP 格式</span
                        >
                      </div>
                    </template>
                  </a-upload>
                </a-spin>
              </div>
            </a-form-item>

            <a-row :gutter="16">
              <a-col :span="12">
                <a-form-item label="默认宽度 (mm)">
                  <a-input-number
                    v-model="form.default_width"
                    placeholder="选填，如 2400"
                  />
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item label="默认高度 (mm)">
                  <a-input-number
                    v-model="form.default_height"
                    placeholder="选填，如 2100"
                  />
                </a-form-item>
              </a-col>
            </a-row>

            <a-form-item label="起步计费面积 (㎡)">
              <a-input-number v-model="form.min_area" placeholder="如 1.5" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>

    <!-- 侧滑抽屉 (width=1100px)：选配加价规则配置 (1-to-N 组与多选项层级卡片) -->
    <a-drawer
      v-model:visible="optionsDrawerVisible"
      title="配置商品加价选配规则 (1个分组包含多个细项配置)"
      :width="1100"
      :unmount-on-close="true"
    >
      <a-spin
        :loading="drawerLoading"
        tip="正在同步拉取最全选配规则..."
        style="width: 100%; display: block; min-height: 380px"
      >
        <div v-if="currentProduct">
          <div class="drawer-header mb-4">
            <h3 style="margin: 0; color: var(--color-text-1); font-size: 18px">
              【{{ currentProduct.name }}】选配规则列表
            </h3>
            <p
              style="
                margin: 6px 0 0 0;
                font-size: 13px;
                color: var(--color-text-3);
              "
            >
              按选配分组进行层级管理（如玻璃配置/五金品牌），每个分组下可配置多个选项细项，同屏同步渲染于小程序端。
            </p>
          </div>

          <div class="mb-4 flex-between">
            <a-tag class="champagne-tag" size="large" style="font-weight: 600"
              >基础定价：¥ {{ currentProduct.base_price_sqm }} / ㎡</a-tag
            >
            <a-button type="primary" size="medium" @click="addGroup">
              <template #icon><icon-plus /></template>
              新增选配分组
            </a-button>
          </div>

          <!-- 1-to-N 选配分组卡片列表 -->
          <template v-if="groupedOptions && groupedOptions.length > 0">
            <div
              v-for="(group, gIdx) in groupedOptions"
              :key="group.id"
              class="option-group-box mb-4"
            >
              <a-card border class="group-card">
                <template #title>
                  <div style="display: flex; align-items: center; gap: 12px">
                    <span
                      style="
                        font-size: 14px;
                        font-weight: 700;
                        color: var(--color-text-1);
                        white-space: nowrap;
                      "
                      >📦 选配分组 {{ gIdx + 1 }}：</span
                    >
                    <a-select
                      v-model="group.group_name"
                      size="medium"
                      allow-create
                      placeholder="选择或手动输入分组名称"
                      style="width: 300px"
                    >
                      <a-option value="玻璃配置">玻璃配置</a-option>
                      <a-option value="门锁配置">门锁配置</a-option>
                      <a-option value="铝材配置">铝材配置</a-option>
                      <a-option value="颜色配置">颜色配置</a-option>
                      <a-option value="开门方向">开门方向</a-option>
                      <a-option value="开门内外">开门内外</a-option>
                      <a-option value="其它选配">其它选配</a-option>
                    </a-select>
                  </div>
                </template>

                <template #extra>
                  <div style="display: flex; gap: 8px">
                    <a-button
                      type="outline"
                      size="small"
                      @click="addItemToGroup(group)"
                    >
                      + 添加组内选项
                    </a-button>
                    <a-button
                      type="outline"
                      status="danger"
                      size="small"
                      @click="removeGroup(gIdx)"
                    >
                      删除分组
                    </a-button>
                  </div>
                </template>

                <!-- 组内选项细项表格 -->
                <a-table
                  :data="group.items"
                  :pagination="false"
                  border
                  size="medium"
                  class="no-wrap-header-table"
                >
                  <template #columns>
                    <a-table-column
                      title="选项名称 (如: 琉璃白 / 双层钢化玻璃)"
                      :width="260"
                    >
                      <template #cell="{ record }">
                        <a-input
                          v-model="record.option_name"
                          size="medium"
                          placeholder="请输入选项名称"
                        />
                      </template>
                    </a-table-column>

                    <a-table-column title="选项示图/色卡 (可选)" :width="160">
                      <template #cell="{ record }">
                        <div
                          style="display: flex; align-items: center; gap: 6px"
                        >
                          <a-popover v-if="record.image_url" trigger="hover">
                            <img
                              :src="record.image_url"
                              style="
                                width: 32px;
                                height: 32px;
                                object-fit: cover;
                                border-radius: 4px;
                                border: 1px solid #e5e6eb;
                                cursor: pointer;
                              "
                            />
                            <template #content>
                              <img
                                :src="record.image_url"
                                style="
                                  max-width: 160px;
                                  max-height: 160px;
                                  border-radius: 6px;
                                "
                              />
                            </template>
                          </a-popover>
                          <a-upload
                            action="https://zc-api.carelife.top/api/upload"
                            :show-file-list="false"
                            @success="
                              (fileItem) =>
                                onOptionImgUploadSuccess(record, fileItem)
                            "
                          >
                            <template #upload-button>
                              <a-button type="outline" size="mini">
                                {{ record.image_url ? "更换" : "上传图" }}
                              </a-button>
                            </template>
                          </a-upload>
                          <a-button
                            v-if="record.image_url"
                            type="text"
                            status="danger"
                            size="mini"
                            @click="record.image_url = ''"
                          >
                            <icon-delete />
                          </a-button>
                        </div>
                      </template>
                    </a-table-column>

                    <a-table-column title="加价方式" :width="180">
                      <template #cell="{ record }">
                        <a-select v-model="record.price_type" size="medium">
                          <a-option value="fixed">固定金额(元)</a-option>
                          <a-option value="per_sqm">按面积加价(元/㎡)</a-option>
                          <a-option value="per_item"
                            >按套数加价(元/套)</a-option
                          >
                        </a-select>
                      </template>
                    </a-table-column>

                    <a-table-column title="加价金额 (元)" :width="160">
                      <template #cell="{ record }">
                        <a-input-number
                          v-model="record.price"
                          :min="0"
                          :precision="2"
                          size="medium"
                          placeholder="0"
                        />
                      </template>
                    </a-table-column>

                    <a-table-column title="默认勾选" :width="120">
                      <template #cell="{ record }">
                        <a-switch
                          v-model="record.is_default"
                          :checked-value="1"
                          :unchecked-value="0"
                          @change="() => handleDefaultSwitch(group, record)"
                        />
                      </template>
                    </a-table-column>

                    <a-table-column title="操作" :width="80">
                      <template #cell="{ record, rowIndex }">
                        <a-button
                          type="text"
                          status="danger"
                          size="small"
                          @click="removeItemFromGroup(group, rowIndex)"
                        >
                          <icon-delete />
                        </a-button>
                      </template>
                    </a-table-column>
                  </template>
                </a-table>
              </a-card>
            </div>
          </template>

          <div v-else class="empty-group-box">
            <a-empty
              description="暂无选配规则分组，点击右上角【+ 新增选配分组】开始创建"
            />
          </div>
        </div>
      </a-spin>
      <template #footer>
        <div
          style="
            display: flex;
            justify-content: flex-end;
            gap: 16px;
            width: 100%;
          "
        >
          <a-button size="large" @click="optionsDrawerVisible = false"
            >取消</a-button
          >
          <a-button
            type="primary"
            size="large"
            :loading="savingOptions"
            @click="saveOptions"
            >保存选配规则配置</a-button
          >
        </div>
      </template>
    </a-drawer>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from "vue";
import { Message } from "@arco-design/web-vue";

import request from "../utils/request";

const categories = ref([
  "断桥铝系统窗",
  "极窄推拉门/平开门",
  "系统封阳台/阳光房",
  "金刚网纱窗及配件",
  "幕墙工程系",
]);

const searchForm = ref({
  categories: [],
  name: "",
});

const products = ref([]);
const tableLoading = ref(true);
const statusLoadingIds = ref(new Set());
const hotLoadingIds = ref(new Set());
const selectedProductIds = ref([]);
const batchStatusSaving = ref(false);
const copyingProductIds = ref(new Set());
const rowSelection = computed(() => ({
  type: "checkbox",
  showCheckedAll: true,
  selectedRowKeys: selectedProductIds.value,
}));

const modalVisible = ref(false);
const optionsDrawerVisible = ref(false);
const drawerLoading = ref(false);
const currentProduct = ref(null);
const uploading = ref(false);

const form = ref({
  id: "",
  name: "",
  description: "",
  cover_image: "",
  category_name: "断桥铝系统窗",
  base_price_sqm: 680,
  min_area: 1,
  is_active: 1,
  is_hot: 0,
  default_width: null,
  default_height: null,
});

const fetchProducts = async () => {
  tableLoading.value = true;
  try {
    const params = new URLSearchParams();
    if (searchForm.value.name && searchForm.value.name.trim()) {
      params.append("name", searchForm.value.name.trim());
    }
    if (searchForm.value.categories && searchForm.value.categories.length > 0) {
      params.append("categories", searchForm.value.categories.join(","));
    }

    const data = await request(`/api/admin/products?${params.toString()}`);
    if (data.success && Array.isArray(data.data)) {
      products.value = data.data.map((p) => ({
        ...p,
        options: p.options || [],
        is_active:
          p.is_active !== undefined && p.is_active !== null
            ? Number(p.is_active)
            : 1,
        is_hot: p.is_hot !== undefined && p.is_hot !== null ? Number(p.is_hot) : 0,
      }));
    } else {
      products.value = [];
    }
  } catch (e) {
    products.value = [];
  } finally {
    tableLoading.value = false;
  }
};

const handleSearch = () => {
  fetchProducts();
};

const handleReset = () => {
  searchForm.value = {
    categories: [],
    name: "",
  };
  fetchProducts();
};

const handleProductSelectionChange = (rowKeys) => {
  selectedProductIds.value = Array.isArray(rowKeys) ? rowKeys : [];
};

const batchUpdateStatus = async (isActive) => {
  const ids = [...selectedProductIds.value];
  if (!ids.length || batchStatusSaving.value) return;
  batchStatusSaving.value = true;
  try {
    const data = await request("/api/admin/products/batch-status", {
      method: "PATCH",
      body: JSON.stringify({ ids, is_active: isActive }),
    });
    if (!data.success) throw new Error(data.message || "批量更新商品状态失败");
    products.value = products.value.map((product) =>
      ids.includes(product.id) ? { ...product, is_active: isActive } : product,
    );
    selectedProductIds.value = [];
    Message.success(`已批量${isActive ? "上架" : "下架"}${data.updated || ids.length} 个商品`);
  } catch (e) {
    Message.error(e?.message || "批量更新商品状态失败");
  } finally {
    batchStatusSaving.value = false;
  }
};

const copyProduct = async (record) => {
  if (!record || copyingProductIds.value.has(record.id)) return;
  copyingProductIds.value = new Set(copyingProductIds.value).add(record.id);
  try {
    const data = await request(`/api/admin/products/${record.id}/copy`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    if (!data.success) throw new Error(data.message || "复制商品失败");
    Message.success(`商品已复制为“${data.name}”，当前默认下架`);
    await fetchProducts();
  } catch (e) {
    Message.error(e?.message || "复制商品失败");
  } finally {
    const copyingIds = new Set(copyingProductIds.value);
    copyingIds.delete(record.id);
    copyingProductIds.value = copyingIds;
  }
};

const openProductModal = () => {
  form.value = {
    id: "",
    name: "",
    description: "",
    cover_image: "",
    category_name: "断桥铝系统窗",
    base_price_sqm: 680,
    min_area: 1,
    is_active: 1,
    is_hot: 0,
    default_width: null,
    default_height: null,
  };
  uploading.value = false;
  modalVisible.value = true;
};

const editProduct = (record) => {
  form.value = {
    id: record.id,
    name: record.name,
    description: record.description || "",
    cover_image: record.cover_image || "",
    category_name: record.category_name || "断桥铝系统窗",
    base_price_sqm: record.base_price_sqm || 680,
    min_area:
      record.min_area !== undefined && record.min_area !== null
        ? Number(record.min_area)
        : 1,
    is_active:
      record.is_active !== undefined && record.is_active !== null
        ? Number(record.is_active)
        : 1,
    is_hot:
      record.is_hot !== undefined && record.is_hot !== null
        ? Number(record.is_hot)
        : 0,
    default_width: record.default_width ? Number(record.default_width) : null,
    default_height: record.default_height
      ? Number(record.default_height)
      : null,
  };
  uploading.value = false;
  modalVisible.value = true;
};

const handleStatusChange = async (record, val) => {
  if (statusLoadingIds.value.has(record.id)) return;
  statusLoadingIds.value = new Set(statusLoadingIds.value).add(record.id);
  try {
    const data = await request(`/api/admin/products/${record.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: val ? 1 : 0 }),
      silent: true,
    });
    if (!data.success) throw new Error(data.message || "商品上下架状态保存失败");
    record.is_active = val ? 1 : 0;
    Message.success(`已成功${val ? "上架" : "下架"}商品【${record.name}】`);
  } catch (e) {
    record.is_active = val ? 0 : 1;
    Message.error(e?.message || "商品上下架状态保存失败");
  } finally {
    const loadingIds = new Set(statusLoadingIds.value);
    loadingIds.delete(record.id);
    statusLoadingIds.value = loadingIds;
  }
};

const handleHotChange = async (record, val) => {
  if (hotLoadingIds.value.has(record.id)) return;
  hotLoadingIds.value = new Set(hotLoadingIds.value).add(record.id);
  try {
    const data = await request(`/api/admin/products/${record.id}/hot`, {
      method: "PATCH",
      body: JSON.stringify({ is_hot: val ? 1 : 0 }),
      silent: true,
    });
    if (!data.success) throw new Error(data.message || "热门推荐状态保存失败");
    record.is_hot = val ? 1 : 0;
    Message.success(`商品【${record.name}】已${val ? "设为" : "取消"}热门推荐`);
  } catch (e) {
    Message.error(e?.message || "热门推荐状态保存失败");
  } finally {
    const loadingIds = new Set(hotLoadingIds.value);
    loadingIds.delete(record.id);
    hotLoadingIds.value = loadingIds;
  }
};

const onOptionImgUploadSuccess = (record, fileItem) => {
  if (fileItem && fileItem.response && fileItem.response.url) {
    record.image_url = fileItem.response.url;
  } else if (fileItem && fileItem.url) {
    record.image_url = fileItem.url;
  }
  Message.success("选项示图/色卡上传成功！");
};

const groupedOptions = ref([]);

const savingOptions = ref(false);

const parseGroupsFromOptions = (rawOptions) => {
  const groupMap = {};
  (rawOptions || []).forEach((opt) => {
    const gName = (opt.group_name || "玻璃配置").trim();
    if (!groupMap[gName]) {
      groupMap[gName] = {
        id: `grp_${Date.now()}_${Math.random()}`,
        group_name: gName,
        items: [],
      };
    }
    groupMap[gName].items.push({
      id: opt.id || `opt_${Date.now()}_${Math.random()}`,
      option_name: opt.option_name || opt.name || "",
      price_type: opt.price_type || "fixed",
      price: opt.price !== undefined ? opt.price : 0,
      is_default: opt.is_default ? 1 : 0,
      image_url: opt.image_url || "",
    });
  });

  let list = Object.values(groupMap);
  if (list.length === 0) {
    list = [
      {
        id: `grp_1_${Date.now()}`,
        group_name: "玻璃配置",
        items: [
          {
            id: `opt_def_1_${Date.now()}`,
            option_name: "双层玻璃",
            price_type: "fixed",
            price: 0,
            is_default: 1,
            image_url: "",
          },
          {
            id: `opt_def_2_${Date.now()}`,
            option_name: "双层钢化玻璃",
            price_type: "fixed",
            price: 50,
            is_default: 0,
            image_url: "",
          },
        ],
      },
      {
        id: `grp_2_${Date.now()}`,
        group_name: "门锁配置",
        items: [
          {
            id: `opt_def_3_${Date.now()}`,
            option_name: "默认门锁",
            price_type: "fixed",
            price: 0,
            is_default: 1,
            image_url: "",
          },
        ],
      },
      {
        id: `grp_3_${Date.now()}`,
        group_name: "铝材配置",
        items: [
          {
            id: `opt_def_4_${Date.now()}`,
            option_name: "默认铝材",
            price_type: "fixed",
            price: 0,
            is_default: 1,
            image_url: "",
          },
        ],
      },
      {
        id: `grp_4_${Date.now()}`,
        group_name: "颜色配置",
        items: [
          {
            id: `opt_def_5_${Date.now()}`,
            option_name: "琉璃白",
            price_type: "fixed",
            price: 0,
            is_default: 1,
            image_url: "",
          },
          {
            id: `opt_def_6_${Date.now()}`,
            option_name: "深空灰",
            price_type: "fixed",
            price: 0,
            is_default: 0,
            image_url: "",
          },
        ],
      },
      {
        id: `grp_5_${Date.now()}`,
        group_name: "开门方向",
        items: [
          {
            id: `opt_def_7_${Date.now()}`,
            option_name: "左锁（左合页）",
            price_type: "fixed",
            price: 0,
            is_default: 1,
            image_url: "",
          },
          {
            id: `opt_def_8_${Date.now()}`,
            option_name: "右锁（左合页）",
            price_type: "fixed",
            price: 0,
            is_default: 0,
            image_url: "",
          },
        ],
      },
      {
        id: `grp_6_${Date.now()}`,
        group_name: "开门内外",
        items: [
          {
            id: `opt_def_9_${Date.now()}`,
            option_name: "内开（朝内打开）",
            price_type: "fixed",
            price: 0,
            is_default: 1,
            image_url: "",
          },
          {
            id: `opt_def_10_${Date.now()}`,
            option_name: "外开（朝外打开）",
            price_type: "fixed",
            price: 0,
            is_default: 0,
            image_url: "",
          },
        ],
      },
    ];
  }
  return list;
};

const openOptionsDrawer = (record) => {
  currentProduct.value = JSON.parse(JSON.stringify(record));
  groupedOptions.value = parseGroupsFromOptions(currentProduct.value.options);
  optionsDrawerVisible.value = true;
  drawerLoading.value = true;

  // 2. 抽屉内异步请求后台最新规则，加载完成后关闭 loading 遮罩
  request(`/api/products/${record.id}`)
    .then((data) => {
      if (data.success && data.data && data.data.options && data.data.options.length > 0) {
        currentProduct.value.options = data.data.options;
        groupedOptions.value = parseGroupsFromOptions(data.data.options);
      }
    })
    .catch(() => {})
    .finally(() => {
      drawerLoading.value = false;
    });
};

const addGroup = () => {
  groupedOptions.value.push({
    id: `grp_${Date.now()}`,
    group_name: "新增选配分组",
    items: [
      {
        id: `opt_${Date.now()}`,
        option_name: "",
        price_type: "fixed",
        price: 0,
        is_default: 1,
        image_url: "",
      },
    ],
  });
};

const removeGroup = (gIndex) => {
  groupedOptions.value.splice(gIndex, 1);
};

const addItemToGroup = (group) => {
  if (!group.items) group.items = [];
  group.items.push({
    id: `opt_${Date.now()}`,
    option_name: "",
    price_type: "fixed",
    price: 0,
    is_default: 0,
    image_url: "",
  });
};

const removeItemFromGroup = (group, itemIndex) => {
  if (group.items) {
    group.items.splice(itemIndex, 1);
  }
};

const handleDefaultSwitch = (group, record) => {
  if (record.is_default === 1) {
    if (group && group.items) {
      group.items.forEach((item) => {
        if (item.id !== record.id) {
          item.is_default = 0;
        }
      });
    }
  }
};

const saveOptions = async () => {
  if (!currentProduct.value) return;
  savingOptions.value = true;

  try {
    const flatList = [];
    (groupedOptions.value || []).forEach((g) => {
      const gName = (g.group_name || "选配分组").trim();
      (g.items || []).forEach((it) => {
        if (it.option_name && it.option_name.trim()) {
          flatList.push({
            id: it.id || `opt_${Date.now()}_${Math.random()}`,
            group_name: gName,
            group_title: gName,
            option_name: it.option_name.trim(),
            price_type: it.price_type || "fixed",
            price: Number(it.price || 0),
            is_default: it.is_default ? 1 : 0,
            image_url: it.image_url || "",
          });
        }
      });
    });

    currentProduct.value.options = flatList;
    const target = products.value.find((p) => p.id === currentProduct.value.id);
    if (target) {
      target.options = flatList;
      products.value = [...products.value];
    }

    const data = await request(
      `/api/admin/products/${currentProduct.value.id}/options`,
      {
        method: "POST",
        body: JSON.stringify({ options: flatList }),
      },
    );
    if (data.success) {
      Message.success("选配规则分组配置保存成功！");
      optionsDrawerVisible.value = false;
      await fetchProducts();
    } else {
      Message.error(data.message || "保存失败");
    }
  } catch (e) {
    Message.error("无法连接后端 API 接口，请检查网络");
  } finally {
    savingOptions.value = false;
  }
};

const onBeforeUpload = () => {
  uploading.value = true;
  return true;
};

const onCoverUploadSuccess = (fileItem) => {
  uploading.value = false;
  if (fileItem && fileItem.response && fileItem.response.url) {
    form.value.cover_image = fileItem.response.url;
  } else if (fileItem && fileItem.url) {
    form.value.cover_image = fileItem.url;
  }
};

const onCoverUploadError = () => {
  uploading.value = false;
  Message.error("图片上传失败，请重试！");
};

const handleBeforeSaveProduct = async () => {
  if (!form.value.name || !form.value.name.trim()) {
    Message.warning("【商品名称】为必填项，请输入后再保存！");
    return false;
  }

  if (!form.value.cover_image) {
    Message.warning("【商品封面主图】为必填项，请上传图片后再保存！");
    return false;
  }

  if (!form.value.category_name) {
    Message.warning("【所属分类】为必选项，请选择分类后再保存！");
    return false;
  }

  try {
    const data = await request(`/api/admin/products`, {
      method: "POST",
      body: JSON.stringify(form.value),
    });
    if (data.success) {
      Message.success("保存成功！");
      await fetchProducts();
      return true;
    } else {
      Message.error(data.message || "保存失败");
      return false;
    }
  } catch (e) {
    Message.error("网络连接异常，保存失败");
    return false;
  }
};

onMounted(() => {
  fetchProducts();
});
</script>

<style scoped>
.products-view {
  display: flex;
  flex-direction: column;
}
.view-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
}
.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.mb-4 {
  margin-bottom: 16px;
}

.champagne-tag {
  background: rgba(197, 168, 128, 0.12) !important;
  color: #a38456 !important;
  border: 1px solid rgba(197, 168, 128, 0.35) !important;
  border-radius: 6px;
}
body[arco-theme="dark"] .champagne-tag {
  background: rgba(197, 168, 128, 0.2) !important;
  color: #e2c7a0 !important;
  border-color: rgba(197, 168, 128, 0.4) !important;
}

:deep(.no-wrap-header-table .arco-table-th-item) {
  white-space: nowrap !important;
}

/* 统一控制 a-image 加载中文字：单行不换行，精致字号 */
:deep(.arco-image-loader),
:deep(.arco-image-loading),
:deep(.arco-image-loader *) {
  white-space: nowrap !important;
  font-size: 11px !important;
  word-break: keep-all !important;
}

:deep(.arco-image-loader) {
  padding: 2px !important;
}

/* 奢华精致上传控件样式 */
.luxury-upload-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.upload-dropzone {
  width: 156px;
  height: 140px;
  border: 1.5px dashed rgba(197, 168, 128, 0.6);
  background: rgba(197, 168, 128, 0.04);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.25s ease;
  box-sizing: border-box;
  padding: 6px;
}

.upload-dropzone:hover {
  border-color: #c5a880;
  background: rgba(197, 168, 128, 0.08);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(197, 168, 128, 0.15);
}

.upload-icon-circle {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: rgba(197, 168, 128, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 6px;
}

.upload-title {
  font-size: 13px;
  font-weight: 600;
  color: #1d2129;
  white-space: nowrap;
}

body[arco-theme="dark"] .upload-title {
  color: #e2e8f0;
}

.upload-sub {
  font-size: 10.5px;
  color: #86909c;
  margin-top: 4px;
  white-space: nowrap;
}

.cover-preview-box {
  width: 156px;
  height: 140px;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
  border: 1.5px solid #c5a880;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  box-sizing: border-box;
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.cover-hover-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(2px);
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.25s ease;
}

.cover-preview-box:hover .cover-hover-mask {
  opacity: 1;
}

.mask-icon {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mask-icon:hover {
  background: rgba(255, 255, 255, 0.45);
  transform: scale(1.1);
}

.mask-icon-delete:hover {
  background: #f53f3f;
  color: #ffffff;
}
.ml-2 {
  margin-left: 8px;
}

.products-view :deep(.search-panel .arco-card-body) {
  padding: 12px 16px;
}
.products-view :deep(.search-panel .arco-form-item) {
  margin-bottom: 0 !important;
}
</style>
