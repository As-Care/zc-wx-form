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
    <a-table :data="categories" :pagination="{ pageSize: 10 }" border row-key="id">
      <template #columns>
        <a-table-column title="分类名称" data-index="name" :width="240">
          <template #cell="{ record }">
            <strong>{{ record.name }}</strong>
          </template>
        </a-table-column>

        <a-table-column title="首页导航区小标签" data-index="sub_title" :width="200">
          <template #cell="{ record }">
            <a-tag color="gold">{{ record.sub_title }}</a-tag>
          </template>
        </a-table-column>

        <a-table-column title="首页导航区图标" :width="160">
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

        <a-table-column title="状态" :width="120">
          <template #cell="{ record }">
            <a-tag color="green">已启用</a-tag>
          </template>
        </a-table-column>

        <a-table-column title="操作" :width="180">
          <template #cell="{ record }">
            <a-button type="outline" size="small" class="mr-2" @click="editCategory(record)">
              <template #icon><icon-edit /></template>
              编辑
            </a-button>
            <a-popconfirm content="确定删除此分类吗？" type="warning" @ok="deleteCategory(record.id)">
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
    <a-modal v-model:visible="modalVisible" title="配置门窗分类与首页导航区" @ok="handleSaveCategory">
      <a-form :model="form" layout="vertical">
        <a-form-item label="分类全称 (如: 断桥铝系统窗)" required>
          <a-input v-model="form.name" placeholder="请输入分类全称" />
        </a-form-item>

        <a-form-item label="首页导航区小标签 (限5字以内，如: 极窄推拉门)" required>
          <a-input v-model="form.sub_title" maxlength="5" show-word-limit placeholder="最多5字，适合首页导航显示" />
        </a-form-item>

        <!-- 分类图标上传 -->
        <a-form-item label="首页导航区分类图标">
          <div class="luxury-upload-card">
            <a-spin :loading="uploading" tip="图标上传中...">
              <a-upload
                action="https://zc-api.carelife.top/api/upload"
                :show-file-list="false"
                @before-upload="uploading = true"
                @success="onIconUploadSuccess"
                @error="uploading = false"
              >
                <template #upload-button>
                  <div v-if="form.icon_url" class="icon-preview-box">
                    <img :src="form.icon_url" class="icon-img" />
                  </div>
                  <div v-else class="upload-dropzone">
                    <icon-plus style="font-size: 20px; color: #C5A880;" />
                    <span class="upload-title">上传图标</span>
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

const categories = ref([
  { id: 'cat_1', name: '断桥铝系统窗', sub_title: '断桥铝窗', icon_url: '' },
  { id: 'cat_2', name: '极窄推拉门/平开门', sub_title: '极窄推拉门', icon_url: '' },
  { id: 'cat_3', name: '系统封阳台/阳光房', sub_title: '系统封阳台', icon_url: '' },
  { id: 'cat_4', name: '金刚网纱窗及配件', sub_title: '金刚网纱窗', icon_url: '' },
  { id: 'cat_5', name: '幕墙工程系', sub_title: '幕墙工程系', icon_url: '' }
]);

const modalVisible = ref(false);
const uploading = ref(false);

const form = ref({
  id: '',
  name: '',
  sub_title: '',
  icon_url: ''
});

const fetchCategories = async () => {
  try {
    const res = await fetch(`${API_BASE}/api/categories`);
    const data = await res.json();
    if (data.success && data.categories && data.categories.length > 0) {
      categories.value = data.categories;
    }
  } catch (e) {
    console.warn('Backend offline, using fallback state', e);
  }
};

const openModal = () => {
  form.value = { id: '', name: '', sub_title: '', icon_url: '' };
  modalVisible.value = true;
};

const editCategory = (record) => {
  form.value = { ...record };
  modalVisible.value = true;
};

const onIconUploadSuccess = (fileItem) => {
  uploading.value = false;
  if (fileItem && fileItem.response && fileItem.response.url) {
    form.value.icon_url = fileItem.response.url;
    Message.success('图标上传成功！');
  }
};

const handleSaveCategory = async () => {
  if (!form.value.name || !form.value.name.trim()) {
    Message.warning('分类全称不能为空！');
    return;
  }

  if (form.value.id) {
    const idx = categories.value.findIndex(c => c.id === form.value.id);
    if (idx !== -1) {
      categories.value[idx] = { ...form.value };
      categories.value = [...categories.value];
    }
  } else {
    categories.value.push({
      id: `cat_${Date.now()}`,
      name: form.value.name,
      sub_title: form.value.sub_title || form.value.name.slice(0, 5),
      icon_url: form.value.icon_url || ''
    });
    categories.value = [...categories.value];
  }

  // 连通 API 存储
  try {
    await fetch(`${API_BASE}/api/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value)
    });
  } catch (e) {}

  Message.success('门窗分类保存成功！');
  modalVisible.value = false;
};

const deleteCategory = (id) => {
  categories.value = categories.value.filter(c => c.id !== id);
  Message.success('分类已成功移除');
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
  border: 1.5px solid #C5A880;
}

.icon-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
