<template>
  <div class="categories-view">
    <div class="header-bar flex-between mb-4">
      <h2 class="view-title">门窗分类与首页导航区配置</h2>
      <a-button type="primary" @click="openModal">
        <template #icon><icon-plus /></template>
        新建门窗分类
      </a-button>
    </div>

    <!-- 分类数据表格 -->
    <a-table :data="categories" :loading="tableLoading" :pagination="{ pageSize: 10 }" border row-key="id">
      <template #columns>
        <a-table-column title="分类名称" data-index="name" :width="220">
          <template #cell="{ record }">
            <strong>{{ record.name }}</strong>
          </template>
        </a-table-column>

        <a-table-column title="首页导航区小标签" data-index="sub_title" :width="180">
          <template #cell="{ record }">
            <a-tag class="champagne-tag">{{ record.sub_title }}</a-tag>
          </template>
        </a-table-column>

        <a-table-column title="首页导航区图标" :width="150">
          <template #cell="{ record }">
            <a-image
              v-if="record.icon_url"
              :src="record.icon_url"
              width="44"
              height="44"
              fit="cover"
              style="border-radius: 8px; border: 1px solid #e5e6eb;"
            />
            <span v-else style="color: #c9cdd4; font-size: 12px;">默认图标</span>
          </template>
        </a-table-column>

        <a-table-column title="排序权重" :width="130">
          <template #cell="{ record }">
            <a-input-number
              v-model="record.sort_order"
              size="small"
              :min="0"
              style="width: 86px;"
              @change="handleQuickSortChange(record)"
            />
          </template>
        </a-table-column>

        <a-table-column title="状态" :width="140">
          <template #cell="{ record }">
            <a-switch
              v-model="record.is_active"
              :checked-value="1"
              :unchecked-value="0"
              @change="(val) => handleStatusChange(record, val)"
            >
              <template #checked>已启用</template>
              <template #unchecked>已禁用</template>
            </a-switch>
          </template>
        </a-table-column>

        <a-table-column title="操作" :width="180">
          <template #cell="{ record }">
            <a-button type="outline" size="small" class="mr-2" @click="editCategory(record)">
              <template #icon><icon-edit /></template>
              编辑
            </a-button>
            <a-popconfirm content="确定彻底删除此门窗分类吗？" type="warning" @ok="deleteCategory(record.id)">
              <a-button type="outline" status="danger" size="small">
                <template #icon><icon-delete /></template>
                删除
              </a-button>
            </a-popconfirm>
          </template>
        </a-table-column>
      </template>
    </a-table>

    <!-- 新建/修改分类 Modal -->
    <a-modal v-model:visible="modalVisible" title="配置门窗分类与首页导航区" :on-before-ok="handleBeforeSaveCategory">
      <a-form :model="form" layout="vertical">
        <a-form-item label="分类全称 (如: 断桥铝系统窗)" required>
          <a-input v-model="form.name" placeholder="请输入分类全称" />
        </a-form-item>

        <a-form-item label="首页导航区小标签 (限5字以内，如: 极窄推拉门)" required>
          <a-input v-model="form.sub_title" maxlength="5" show-word-limit placeholder="最多5字，适合首页导航显示" />
        </a-form-item>

        <a-form-item label="排序权重 (数字越小越靠前显示)" required>
          <a-input-number v-model="form.sort_order" :min="0" placeholder="默认0，数字越小越靠前显示" />
        </a-form-item>

        <a-form-item label="分类状态" required>
          <a-radio-group v-model="form.is_active" type="button">
            <a-radio :value="1">启用 (小程序端展示)</a-radio>
            <a-radio :value="0">禁用 (停用隐藏)</a-radio>
          </a-radio-group>
        </a-form-item>

        <!-- 首页导航区分类图标 -->
        <a-form-item label="首页导航区分类图标">
          <div class="luxury-upload-card">
            <a-spin :loading="uploading" tip="正在上传中">
              <div v-if="form.icon_url" class="icon-preview-box">
                <img :src="form.icon_url" class="icon-img" />
                <div class="icon-hover-mask">
                  <a-upload
                    action="https://zc-api.carelife.top/api/upload"
                    :show-file-list="false"
                    @before-upload="onBeforeUpload"
                    @success="onIconUploadSuccess"
                    @error="onIconUploadError"
                    style="display: inline-block;"
                  >
                    <template #upload-button>
                      <span class="mask-icon" title="更换图片">
                        <icon-camera />
                      </span>
                    </template>
                  </a-upload>
                  <span class="mask-icon mask-icon-delete ml-2" title="删除图片" @click.stop="form.icon_url = ''">
                    <icon-delete />
                  </span>
                </div>
              </div>
              <a-upload
                v-else
                action="https://zc-api.carelife.top/api/upload"
                :show-file-list="false"
                @before-upload="onBeforeUpload"
                @success="onIconUploadSuccess"
                @error="onIconUploadError"
              >
                <template #upload-button>
                  <div class="upload-dropzone">
                    <icon-plus style="font-size: 20px; color: #C5A880;" />
                    <span class="upload-title">上传图片</span>
                  </div>
                </template>
              </a-upload>
            </a-spin>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Message } from '@arco-design/web-vue';

const API_BASE = 'https://zc-api.carelife.top';

const DEFAULT_CATEGORIES = [
  { id: 'cat_1', name: '断桥铝系统窗', sub_title: '系统断桥窗', icon_url: '', sort_order: 1, is_active: 1 },
  { id: 'cat_2', name: '极窄推拉门/平开门', sub_title: '极窄推拉门', icon_url: '', sort_order: 2, is_active: 1 },
  { id: 'cat_3', name: '系统封阳台/阳光房', sub_title: '封阳台阳光房', icon_url: '', sort_order: 3, is_active: 1 },
  { id: 'cat_4', name: '金刚网纱窗及配件', sub_title: '金刚网纱窗', icon_url: '', sort_order: 4, is_active: 1 },
  { id: 'cat_5', name: '幕墙工程系', sub_title: '幕墙工程系', icon_url: '', sort_order: 5, is_active: 1 }
];

const categories = ref([]);
const tableLoading = ref(true);

const modalVisible = ref(false);
const uploading = ref(false);

const form = ref({
  id: '',
  name: '',
  sub_title: '',
  icon_url: '',
  sort_order: 0,
  is_active: 1
});

const fetchCategories = async () => {
  tableLoading.value = true;
  try {
    const res = await fetch(`${API_BASE}/api/admin/categories`);
    const data = await res.json();
    const list = data.data || data.categories;
    if (data.success && list && list.length > 0) {
      categories.value = list.map(c => ({
        ...c,
        sort_order: (c.sort_order !== undefined && c.sort_order !== null) ? Number(c.sort_order) : 0,
        is_active: (c.is_active !== undefined && c.is_active !== null) ? Number(c.is_active) : 1
      }));
    } else {
      categories.value = DEFAULT_CATEGORIES;
    }
  } catch (e) {
    categories.value = DEFAULT_CATEGORIES;
  } finally {
    tableLoading.value = false;
  }
};

const openModal = () => {
  form.value = { id: '', name: '', sub_title: '', icon_url: '', sort_order: 0, is_active: 1 };
  uploading.value = false;
  modalVisible.value = true;
};

const editCategory = (record) => {
  form.value = {
    id: record.id,
    name: record.name,
    sub_title: record.sub_title,
    icon_url: record.icon_url || '',
    sort_order: (record.sort_order !== undefined && record.sort_order !== null) ? Number(record.sort_order) : 0,
    is_active: (record.is_active !== undefined && record.is_active !== null) ? Number(record.is_active) : 1
  };
  uploading.value = false;
  modalVisible.value = true;
};

const onBeforeUpload = () => {
  uploading.value = true;
  return true;
};

const onIconUploadSuccess = (fileItem) => {
  uploading.value = false;
  if (fileItem && fileItem.response && fileItem.response.url) {
    form.value.icon_url = fileItem.response.url;
  } else if (fileItem && fileItem.url) {
    form.value.icon_url = fileItem.url;
  }
};

const onIconUploadError = () => {
  uploading.value = false;
  Message.error('图片上传失败，请重试');
};

const handleBeforeSaveCategory = async () => {
  if (!form.value.name || !form.value.name.trim()) {
    Message.warning('分类全称不能为空！');
    return false;
  }

  try {
    const res = await fetch(`${API_BASE}/api/admin/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value)
    });
    const data = await res.json();

    if (res.ok && data.success) {
      Message.success('保存成功！');
      await fetchCategories();
      return true;
    } else {
      Message.error(data.message || `保存失败 (HTTP ${res.status})`);
      return false;
    }
  } catch (e) {
    Message.error('网络错误，无法保存分类');
    return false;
  }
};

const handleQuickSortChange = async (record) => {
  try {
    const res = await fetch(`${API_BASE}/api/admin/categories/${record.id}/sort`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sort_order: record.sort_order })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      Message.success('排序更正成功！');
      await fetchCategories();
    } else {
      Message.error(data.message || '排序更正失败');
    }
  } catch (e) {
    Message.error('网络错误，无法修改排序');
  }
};

const handleStatusChange = async (record, val) => {
  try {
    const res = await fetch(`${API_BASE}/api/admin/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: record.id,
        name: record.name,
        sub_title: record.sub_title,
        icon_url: record.icon_url || '',
        sort_order: record.sort_order || 0,
        is_active: val
      })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      Message.success(`已成功${val === 1 ? '启用' : '禁用'}分类【${record.name}】`);
      await fetchCategories();
    } else {
      Message.error('状态修改失败');
      record.is_active = val === 1 ? 0 : 1;
    }
  } catch (e) {
    Message.error('网络联通失败');
    record.is_active = val === 1 ? 0 : 1;
  }
};

const deleteCategory = async (id) => {
  try {
    const res = await fetch(`${API_BASE}/api/admin/categories/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok && data.success) {
      Message.success('删除成功！');
      await fetchCategories();
    } else {
      Message.error(data.message || `删除失败 (HTTP ${res.status})`);
    }
  } catch (e) {
    Message.error('无法连接后端服务');
  }
};

onMounted(() => {
  fetchCategories();
});
</script>

<style scoped>
.categories-view { display: flex; flex-direction: column; }
.view-title { font-size: 20px; font-weight: 700; margin: 0; }
.flex-between { display: flex; justify-content: space-between; align-items: center; }
.mb-4 { margin-bottom: 16px; }
.mr-2 { margin-right: 8px; }

.upload-dropzone {
  width: 90px;
  height: 90px;
  border: 1.5px dashed rgba(197, 168, 128, 0.6);
  background: rgba(197, 168, 128, 0.04);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.upload-title {
  font-size: 11px;
  color: #86909c;
  margin-top: 4px;
}

.icon-preview-box {
  width: 90px;
  height: 90px;
  border-radius: 10px;
  overflow: hidden;
  position: relative;
  border: 1.5px solid #C5A880;
}

.icon-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.icon-hover-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.25s ease;
  backdrop-filter: blur(2px);
}

.icon-preview-box:hover .icon-hover-mask {
  opacity: 1;
}

.mask-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
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

:deep(.champagne-tag) {
  background-color: #c5a880 !important;
  color: #ffffff !important;
  font-weight: 600 !important;
  border: none !important;
  border-radius: 4px;
}

:deep(.arco-image-loader),
:deep(.arco-image-loading),
:deep(.arco-image-loader *) {
  white-space: nowrap !important;
  font-size: 11px !important;
  word-break: keep-all !important;
}
</style>
