<template>
  <div class="banners-view">
    <div class="header-bar flex-between mb-4">
      <h2 class="view-title">首页 Banner 管理</h2>
      <a-button type="primary" @click="openCreate">
        <template #icon><icon-plus /></template>
        新增 Banner
      </a-button>
    </div>

    <a-table
      :data="banners"
      :loading="tableLoading"
      :pagination="{ pageSize: 10 }"
      border
      row-key="id"
    >
      <template #columns>
        <a-table-column title="预览图" :width="150">
          <template #cell="{ record }">
            <a-image
              :src="record.image_url"
              width="120"
              height="64"
              fit="cover"
              style="border-radius: 8px"
              show-loader
            />
          </template>
        </a-table-column>
        <a-table-column title="Banner 名称" :width="220">
          <template #cell="{ record }">
            <strong>{{ record.name }}</strong>
            <div v-if="record.subtitle" class="muted-text">{{ record.subtitle }}</div>
          </template>
        </a-table-column>
        <a-table-column title="绑定商品" :width="220">
          <template #cell="{ record }">
            <a-tag v-if="record.product_id" color="arcoblue">
              {{ record.product_name || record.product_id }}
            </a-tag>
            <span v-else class="muted-text">不绑定商品</span>
          </template>
        </a-table-column>
        <a-table-column title="排序" data-index="sort_order" :width="90" />
        <a-table-column title="状态" :width="120">
          <template #cell="{ record }">
            <a-switch
              :model-value="record.is_active === 1"
              :loading="statusLoadingIds.has(record.id)"
              @change="(value) => toggleStatus(record, value)"
            >
              <template #checked>启用</template>
              <template #unchecked>停用</template>
            </a-switch>
          </template>
        </a-table-column>
        <a-table-column title="操作" :width="150">
          <template #cell="{ record }">
            <a-space>
              <a-button type="outline" size="small" @click="openEdit(record)">编辑</a-button>
              <a-popconfirm content="确定删除这个 Banner 吗？" type="warning" @ok="deleteBanner(record)">
                <a-button type="outline" status="danger" size="small">删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </a-table-column>
      </template>
    </a-table>

    <a-modal
      v-model:visible="modalVisible"
      :title="editingId ? '编辑 Banner' : '新增 Banner'"
      :ok-loading="saveLoading"
      :on-before-ok="saveBanner"
      width="640px"
    >
      <a-form :model="form" layout="vertical">
        <a-form-item label="Banner 名称" required>
          <a-input v-model="form.name" placeholder="例如：展晨尊享系统封阳台" />
        </a-form-item>
        <a-form-item label="副标题（可选）">
          <a-input v-model="form.subtitle" placeholder="例如：全气候级隔热 · 抗风暴结构" />
        </a-form-item>
        <a-form-item label="Banner 图片" required>
          <a-spin :loading="uploading" tip="正在上传图片...">
            <div v-if="form.image_url" class="image-preview-box">
              <img :src="form.image_url" alt="Banner 预览" />
              <a-upload
                :action="uploadAction"
                :show-file-list="false"
                @before-upload="onBeforeUpload"
                @success="onUploadSuccess"
                @error="onUploadError"
              >
                <a-button size="small">更换图片</a-button>
              </a-upload>
            </div>
            <a-upload
              v-else
              :action="uploadAction"
              :show-file-list="false"
              @before-upload="onBeforeUpload"
              @success="onUploadSuccess"
              @error="onUploadError"
            >
              <a-button>上传 Banner 图片</a-button>
            </a-upload>
          </a-spin>
        </a-form-item>
        <a-form-item label="绑定商品（可选）">
          <div class="product-bind-field">
            <a-select v-model="form.product_id" allow-clear placeholder="不绑定商品" style="width: 100%">
              <a-option v-for="product in products" :key="product.id" :value="product.id">
                {{ product.name }}{{ Number(product.is_active) === 1 ? '' : '（已下架）' }}
              </a-option>
            </a-select>
            <div class="form-tip">绑定商品后，小程序点击该 Banner 会直接进入商品详情。</div>
          </div>
        </a-form-item>
        <a-form-item label="排序（数字越小越靠前）">
          <a-input-number v-model="form.sort_order" :min="0" :max="999" />
        </a-form-item>
        <a-form-item label="是否启用">
          <a-switch v-model="form.is_active" :checked-value="1" :unchecked-value="0">
            <template #checked>启用</template>
            <template #unchecked>停用</template>
          </a-switch>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { Message } from "@arco-design/web-vue";
import request from "../utils/request";
import { API_BASE } from "../config";

const uploadAction = `${API_BASE}/api/upload`;
const banners = ref([]);
const products = ref([]);
const tableLoading = ref(false);
const uploading = ref(false);
const saveLoading = ref(false);
const modalVisible = ref(false);
const editingId = ref("");
const statusLoadingIds = ref(new Set());
const form = ref({
  name: "",
  subtitle: "",
  image_url: "",
  product_id: "",
  sort_order: 0,
  is_active: 1,
});

const fetchBanners = async () => {
  tableLoading.value = true;
  try {
    const data = await request("/api/admin/banners");
    if (!data.success) throw new Error(data.message || "Banner 加载失败");
    banners.value = data.data || [];
  } catch (error) {
    banners.value = [];
  } finally {
    tableLoading.value = false;
  }
};

const fetchProducts = async () => {
  try {
    const data = await request("/api/admin/products", { silent: true });
    if (data.success) products.value = data.data || [];
  } catch (error) {}
};

const resetForm = () => {
  editingId.value = "";
  form.value = {
    name: "",
    subtitle: "",
    image_url: "",
    product_id: "",
    sort_order: banners.value.length,
    is_active: 1,
  };
  uploading.value = false;
};

const openCreate = () => {
  resetForm();
  modalVisible.value = true;
};

const openEdit = (record) => {
  editingId.value = record.id;
  form.value = {
    name: record.name || "",
    subtitle: record.subtitle || "",
    image_url: record.image_url || "",
    product_id: record.product_id || "",
    sort_order: Number(record.sort_order || 0),
    is_active: Number(record.is_active) === 0 ? 0 : 1,
  };
  uploading.value = false;
  modalVisible.value = true;
};

const onBeforeUpload = () => {
  uploading.value = true;
  return true;
};

const onUploadSuccess = (fileItem) => {
  uploading.value = false;
  const url = fileItem?.response?.url || fileItem?.url;
  if (url) {
    form.value.image_url = url;
    Message.success("Banner 图片上传成功");
  } else {
    Message.error("上传成功但未返回图片地址");
  }
};

const onUploadError = () => {
  uploading.value = false;
  Message.error("Banner 图片上传失败，请重试");
};

const saveBanner = async () => {
  if (saveLoading.value) return false;
  if (!form.value.name.trim() || !form.value.image_url) {
    Message.warning("请填写 Banner 名称并上传图片");
    return false;
  }
  saveLoading.value = true;
  try {
    const url = editingId.value ? `/api/admin/banners/${editingId.value}` : "/api/admin/banners";
    const data = await request(url, {
      method: editingId.value ? "PUT" : "POST",
      body: JSON.stringify(form.value),
    });
    if (!data.success) throw new Error(data.message || "Banner 保存失败");
    Message.success("Banner 保存成功");
    await fetchBanners();
    return true;
  } catch (error) {
    Message.error(error?.message || "Banner 保存失败");
    return false;
  } finally {
    saveLoading.value = false;
  }
};

const toggleStatus = async (record, value) => {
  if (statusLoadingIds.value.has(record.id)) return;
  statusLoadingIds.value = new Set(statusLoadingIds.value).add(record.id);
  try {
    const data = await request(`/api/admin/banners/${record.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: value ? 1 : 0 }),
      silent: true,
    });
    if (!data.success) throw new Error(data.message || "Banner 状态更新失败");
    record.is_active = value ? 1 : 0;
    Message.success(`Banner 已${value ? "启用" : "停用"}`);
  } catch (error) {
    Message.error(error?.message || "Banner 状态更新失败");
  } finally {
    const ids = new Set(statusLoadingIds.value);
    ids.delete(record.id);
    statusLoadingIds.value = ids;
  }
};

const deleteBanner = async (record) => {
  try {
    const data = await request(`/api/admin/banners/${record.id}`, { method: "DELETE" });
    if (!data.success) throw new Error(data.message || "Banner 删除失败");
    Message.success("Banner 已删除");
    await fetchBanners();
  } catch (error) {
    Message.error(error?.message || "Banner 删除失败");
  }
};

onMounted(() => {
  fetchBanners();
  fetchProducts();
});
</script>

<style scoped>
.banners-view { display: flex; flex-direction: column; }
.header-bar { display: flex; align-items: center; }
.view-title { margin: 0; font-size: 20px; font-weight: 700; }
.muted-text { margin-top: 4px; color: var(--color-text-3); font-size: 12px; }
.product-bind-field { width: 100%; display: flex; flex-direction: column; align-items: stretch; }
.form-tip { margin-top: 6px; color: var(--color-text-3); font-size: 12px; }
.image-preview-box { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
.image-preview-box img { width: 360px; height: 160px; object-fit: cover; border-radius: 8px; border: 1px solid var(--color-border-2); }
</style>
