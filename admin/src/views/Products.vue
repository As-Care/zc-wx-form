<template>
  <div class="products-view">
    <div class="header-bar flex-between mb-4">
      <h2 class="view-title">门窗商品方案管理</h2>
      <a-button type="primary" @click="openProductModal">
        <template #icon><icon-plus /></template>
        新建门窗商品
      </a-button>
    </div>

    <!-- 门窗商品数据表格 -->
    <a-table :data="products" :loading="tableLoading" :pagination="{ pageSize: 10 }" border row-key="id" class="no-wrap-header-table">
      <template #columns>
        <a-table-column title="商品主图" :width="110">
          <template #cell="{ record }">
            <a-image
              v-if="record.cover_image"
              :src="record.cover_image"
              width="64"
              height="64"
              fit="cover"
              style="border-radius: 8px; border: 1px solid #e5e6eb; cursor: pointer;"
              show-loader
            />
            <span v-else style="color: #c9cdd4; font-size: 12px;">暂无主图</span>
          </template>
        </a-table-column>

        <a-table-column title="商品名称" data-index="name" :width="220">
          <template #cell="{ record }">
            <div>
              <strong>{{ record.name }}</strong>
              <div style="font-size: 12px; color: #86909c; margin-top: 4px;">{{ record.description }}</div>
            </div>
          </template>
        </a-table-column>

        <a-table-column title="所属分类" data-index="category_name" :width="150">
          <template #cell="{ record }">
            <a-tag class="soft-cat-tag">{{ record.category_name || '门窗分类' }}</a-tag>
          </template>
        </a-table-column>

        <a-table-column title="基础平米单价" data-index="base_price_sqm" :width="140">
          <template #cell="{ record }">
            <strong style="color: #b89768; font-size: 15px;">¥ {{ record.base_price_sqm }} / ㎡</strong>
          </template>
        </a-table-column>

        <a-table-column title="起步计费面积" data-index="min_area" :width="120">
          <template #cell="{ record }">
            {{ record.min_area }} ㎡
          </template>
        </a-table-column>

        <a-table-column title="选配加价规则" :width="160">
          <template #cell="{ record }">
            <a-tag color="arcoblue" style="cursor: pointer;" @click="openOptionsDrawer(record)">
              <template #icon><icon-settings /></template>
              {{ record.options ? record.options.length : 0 }} 项规则 (点击配置)
            </a-tag>
          </template>
        </a-table-column>

        <a-table-column title="状态" :width="90">
          <template #cell="{ record }">
            <a-tag color="green">已上架</a-tag>
          </template>
        </a-table-column>

        <a-table-column title="操作" :width="200">
          <template #cell="{ record }">
            <a-button type="text" size="small" @click="editProduct(record)">修改价格/主图</a-button>
            <a-button type="text" status="warning" size="small" @click="openOptionsDrawer(record)">加价选配</a-button>
          </template>
        </a-table-column>
      </template>
    </a-table>

    <!-- 新建/修改商品 Modal -->
    <a-modal v-model:visible="modalVisible" title="配置门窗商品与主图" @ok="handleSaveProduct">
      <a-form :model="form" layout="vertical">
        <a-form-item
          field="name"
          label="商品名称"
          required
          :rules="[{ required: true, message: '商品名称为必填项' }]"
        >
          <a-input v-model="form.name" placeholder="请输入商品全称（必填）" />
        </a-form-item>

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
                    style="display: inline-block;"
                  >
                    <template #upload-button>
                      <span class="mask-icon" title="更换主图">
                        <icon-camera />
                      </span>
                    </template>
                  </a-upload>
                  <span class="mask-icon mask-icon-delete ml-2" title="删除主图" @click.stop="form.cover_image = ''">
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
                      <icon-plus style="font-size: 22px; color: #C5A880;" />
                    </div>
                    <span class="upload-title">点击上传图片</span>
                    <span class="upload-sub">支持 PNG / JPG / WEBP 格式</span>
                  </div>
                </template>
              </a-upload>
            </a-spin>
          </div>
        </a-form-item>

        <a-form-item
          field="category_name"
          label="所属分类"
          required
          :rules="[{ required: true, message: '请选择所属分类' }]"
        >
          <a-select v-model="form.category_name" placeholder="请选择分类（必选）">
            <a-option v-for="cat in categories" :key="cat" :value="cat">
              {{ cat }}
            </a-option>
          </a-select>
        </a-form-item>

        <a-form-item label="简短描述说明">
          <a-input v-model="form.description" placeholder="高隔音高隔热，适合高层住宅与阳台封窗" />
        </a-form-item>

        <a-form-item label="基础平米单价 (元/㎡)">
          <a-input-number v-model="form.base_price_sqm" placeholder="如 680" />
        </a-form-item>

        <a-form-item label="起步计费面积 (㎡)">
          <a-input-number v-model="form.min_area" placeholder="如 1.5" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 侧滑抽屉 (width=1100px)：选配加价规则配置 -->
    <a-drawer
      v-model:visible="optionsDrawerVisible"
      title="配置加价选配规则 (玻璃/五金/颜色)"
      :width="1100"
      :footer="false"
    >
      <div v-if="currentProduct">
        <div class="drawer-header mb-4">
          <h3 style="margin: 0; color: #1d2129; font-size: 18px;">【{{ currentProduct.name }}】选配规则列表</h3>
          <p style="margin: 6px 0 0 0; font-size: 13px; color: #86909c;">支持选择预设分组或直接手动输入自定义分组名称，同步渲染于小程序端。</p>
        </div>

        <div class="mb-4 flex-between">
          <a-tag color="gold" size="large" style="font-weight: 600;">基础定价：¥ {{ currentProduct.base_price_sqm }} / ㎡</a-tag>
          <a-button type="primary" size="medium" @click="addOptionRow">
            <template #icon><icon-plus /></template>
            添加加价选配项
          </a-button>
        </div>

        <a-table :data="currentProduct.options" :pagination="false" border size="medium" class="no-wrap-header-table">
          <template #columns>
            <a-table-column title="选配分组 (可自定义)" :width="190">
              <template #cell="{ record }">
                <a-select v-model="record.group_name" size="medium" allow-create placeholder="选择或输入分组">
                  <a-option value="玻璃配置">玻璃配置</a-option>
                  <a-option value="五金执手">五金执手</a-option>
                  <a-option value="型材颜色">型材颜色</a-option>
                  <a-option value="其它选配">其它选配</a-option>
                </a-select>
              </template>
            </a-table-column>

            <a-table-column title="选项名称" :width="280">
              <template #cell="{ record }">
                <a-input v-model="record.option_name" size="medium" placeholder="如: Low-E超白隔热玻璃" />
              </template>
            </a-table-column>

            <a-table-column title="加价方式" :width="180">
              <template #cell="{ record }">
                <a-select v-model="record.price_type" size="medium">
                  <a-option value="per_sqm">按平米(元/㎡)</a-option>
                  <a-option value="per_item">按件/扇(元/件)</a-option>
                  <a-option value="fixed">固定金额(元)</a-option>
                </a-select>
              </template>
            </a-table-column>

            <a-table-column title="加价金额 (元)" :width="140">
              <template #cell="{ record }">
                <a-input-number v-model="record.price" size="medium" :min="0" placeholder="0" />
              </template>
            </a-table-column>

            <a-table-column title="默认勾选" :width="100">
              <template #cell="{ record }">
                <a-switch v-model="record.is_default" size="medium" :checked-value="1" :unchecked-value="0" />
              </template>
            </a-table-column>

            <a-table-column title="操作" :width="80">
              <template #cell="{ record, rowIndex }">
                <a-button type="text" status="danger" size="medium" @click="removeOptionRow(rowIndex)">
                  <template #icon><icon-delete /></template>
                </a-button>
              </template>
            </a-table-column>
          </template>
        </a-table>

        <div style="margin-top: 32px; display: flex; justify-content: flex-end; gap: 16px;">
          <a-button size="large" @click="optionsDrawerVisible = false">取消</a-button>
          <a-button type="primary" size="large" @click="saveOptions">保存选配规则配置</a-button>
        </div>
      </div>
    </a-drawer>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Message } from '@arco-design/web-vue';

const API_BASE = 'https://zc-api.carelife.top';

const categories = ref([
  '断桥铝系统窗',
  '极窄推拉门/平开门',
  '系统封阳台/阳光房',
  '金刚网纱窗及配件',
  '幕墙工程系'
]);

const DEFAULT_PRODUCTS = [
  { id: 'prod_1', category_id: 'cat_1', category_name: '断桥铝系统窗', name: '110断桥铝系统平开窗', description: '壁厚1.8mm，配LOW-E双玻中空，德国好博/施格兰五金', cover_image: 'https://zc-oss.carelife.top/common/prod-110.png', base_price_sqm: 880, min_area: 1.5 },
  { id: 'prod_2', category_id: 'cat_2', category_name: '极窄推拉门/平开门', name: '极窄边框推拉门 (磁吸静音)', description: '极简2.0cm极窄边框，高强度铝钛合金，静音缓冲滑轮', cover_image: 'https://zc-oss.carelife.top/common/prod-narrow-door.png', base_price_sqm: 750, min_area: 1.5 }
];

const products = ref([]);
const tableLoading = ref(true);

const modalVisible = ref(false);
const optionsDrawerVisible = ref(false);
const currentProduct = ref(null);
const uploading = ref(false);

const form = ref({
  id: '',
  name: '',
  description: '',
  cover_image: '',
  category_name: '断桥铝系统窗',
  base_price_sqm: 680,
  min_area: 1.5
});

const fetchProducts = async () => {
  tableLoading.value = true;
  try {
    const res = await fetch(`${API_BASE}/api/products`);
    const data = await res.json();
    if (data.success && data.data && data.data.length > 0) {
      products.value = data.data;
    } else {
      products.value = DEFAULT_PRODUCTS;
    }
  } catch (e) {
    products.value = DEFAULT_PRODUCTS;
  } finally {
    tableLoading.value = false;
  }
};

const openProductModal = () => {
  form.value = {
    id: '',
    name: '',
    description: '',
    cover_image: '',
    category_name: '断桥铝系统窗',
    base_price_sqm: 680,
    min_area: 1.5
  };
  uploading.value = false;
  modalVisible.value = true;
};

const editProduct = (record) => {
  form.value = { ...record };
  uploading.value = false;
  modalVisible.value = true;
};

const openOptionsDrawer = async (record) => {
  currentProduct.value = JSON.parse(JSON.stringify(record));
  if (!currentProduct.value.options) {
    currentProduct.value.options = [];
  }
  try {
    const res = await fetch(`${API_BASE}/api/products/${record.id}`);
    const data = await res.json();
    if (data.success && data.data && data.data.options) {
      currentProduct.value.options = data.data.options;
    }
  } catch (e) {}

  optionsDrawerVisible.value = true;
};

const addOptionRow = () => {
  if (currentProduct.value) {
    currentProduct.value.options.push({
      id: `opt_${Date.now()}`,
      group_name: '玻璃配置',
      option_name: '',
      price_type: 'per_sqm',
      price: 0,
      is_default: 0
    });
  }
};

const removeOptionRow = (index) => {
  if (currentProduct.value && currentProduct.value.options) {
    currentProduct.value.options.splice(index, 1);
  }
};

const saveOptions = () => {
  if (currentProduct.value) {
    const target = products.value.find(p => p.id === currentProduct.value.id);
    if (target) {
      target.options = currentProduct.value.options;
      products.value = [...products.value];
    }
    Message.success('选配加价规则保存成功！');
    optionsDrawerVisible.value = false;
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
  Message.error('图片上传失败，请重试！');
};

const handleSaveProduct = async () => {
  if (!form.value.name || !form.value.name.trim()) {
    Message.warning('【商品名称】为必填项，请输入后再保存！');
    return;
  }

  if (!form.value.cover_image) {
    Message.warning('【商品封面主图】为必填项，请上传图片后再保存！');
    return;
  }

  if (!form.value.category_name) {
    Message.warning('【所属分类】为必选项，请选择分类后再保存！');
    return;
  }

  if (form.value.id) {
    const idx = products.value.findIndex(p => p.id === form.value.id);
    if (idx !== -1) {
      products.value[idx] = { ...form.value };
      products.value = [...products.value];
    }
  } else {
    products.value.push({
      id: `prod_${Date.now()}`,
      name: form.value.name,
      description: form.value.description || '',
      cover_image: form.value.cover_image,
      category_name: form.value.category_name,
      base_price_sqm: form.value.base_price_sqm || 680,
      min_area: form.value.min_area || 1.5,
      options: []
    });
    products.value = [...products.value];
  }

  try {
    const res = await fetch(`${API_BASE}/api/admin/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value)
    });
    const data = await res.json();
    if (res.ok && data.success) {
      Message.success('保存成功！');
      modalVisible.value = false;
      await fetchProducts();
    } else {
      Message.error(data.message || `保存失败 (HTTP ${res.status})`);
    }
  } catch (e) {
    Message.error('网络连接异常，保存失败');
  }
};

onMounted(() => {
  fetchProducts();
});
</script>

<style scoped>
.products-view { display: flex; flex-direction: column; }
.view-title { font-size: 20px; font-weight: 700; margin: 0; }
.flex-between { display: flex; justify-content: space-between; align-items: center; }
.mb-4 { margin-bottom: 16px; }

:deep(.no-wrap-header-table .arco-table-th-item) {
  white-space: nowrap !important;
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
  border-color: #C5A880;
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

body[arco-theme='dark'] .upload-title {
  color: #E2E8F0;
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
  border: 1.5px solid #C5A880;
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
.ml-2 { margin-left: 8px; }
</style>
