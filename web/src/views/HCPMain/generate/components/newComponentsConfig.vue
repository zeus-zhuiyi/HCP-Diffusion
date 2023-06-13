<template>
  <h-collapse title="New_components Config" showSwitch v-model="isOpenNewComponentsConfig">
    <template v-if="keyLength">
      <!-- scheduler -->
      <HBlock label="scheduler" :h-index="2">
        <div class="config-row">
          <HConfigInput label="_target_" disabled v-model="config.scheduler._target_" />
          <HConfigInput label="beta_schedule" v-model="config.scheduler.beta_schedule" />
        </div>
        <div class="config-row">
          <HConfigInputNumber
            label="beta_start"
            :min="config.scheduler.beta_end"
            :max="1"
            :step="0.00001"
            v-model="config.scheduler.beta_start"
          />
          <HConfigInputNumber
            label="beta_end"
            :min="0"
            :max="1"
            :step="0.01"
            v-model="config.scheduler.beta_end"
          />
        </div>
      </HBlock>
      <!-- vae -->
      <HBlock label="vae" :h-index="2" showSwitch v-model="isOpenNewComponentsVaeConfig">
        <div class="config-row" v-if="config.vae">
          <HConfigInput label="_target_" required v-model="config.vae._target_" />
          <HConfigSelect
            label="pretrained_model_name_or_path"
            :options="pretrained_model_name_or_path_options"
            v-model="config.vae.pretrained_model_name_or_path"
          />
        </div>
      </HBlock>
    </template>
  </h-collapse>
</template>
<script>
import { default_data } from '@/constants/index';
import { isEmpty } from 'lodash-es';
export default {
  name: 'NewComponentsConfig',
  props: {
    params: {
      type: Object,
      default: () => {}
    },
    pretrained_model_name_or_path_options: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      isOpenNewComponentsConfig: false,
      isOpenNewComponentsVaeConfig: false,

      // 备份 params.new_components
      cacheConfig: JSON.parse(JSON.stringify(default_data.new_components)),
      initNewComponentsVae: JSON.parse(JSON.stringify(default_data.new_components.vae)),

      config: JSON.parse(JSON.stringify(default_data.new_components))
    };
  },
  computed: {
    keyLength() {
      return Object.keys(this.config).length;
    }
  },
  watch: {
    // params.new_components 开关
    isOpenNewComponentsConfig: {
      handler: function (val) {
        if (val && isEmpty(this.config) && isEmpty(this.cacheConfig)) {
          this.config = JSON.parse(JSON.stringify(default_data.new_components));
          this.cacheConfig = JSON.parse(JSON.stringify(default_data.new_components));
        }

        const { isOpenNewComponentsVaeConfig, initNewComponentsVae } = this;
        if (val) {
          this.config = JSON.parse(
            JSON.stringify({
              ...this.cacheConfig,
              vae: isOpenNewComponentsVaeConfig ? initNewComponentsVae : null
            })
          );
        } else {
          this.cacheConfig = JSON.parse(JSON.stringify(this.config));
          if (isOpenNewComponentsVaeConfig) {
            this.initNewComponentsVae = JSON.parse(JSON.stringify(this.config.vae));
          }
          this.config = {};
        }
      },
      immediate: true
    },
    // params.new_components.vae 开关
    isOpenNewComponentsVaeConfig: {
      handler: function (val) {
        if (val) {
          this.config.vae = JSON.parse(JSON.stringify(this.initNewComponentsVae));
        } else {
          if (!this.config.vae) return;
          this.initNewComponentsVae = JSON.parse(JSON.stringify(this.config.vae));
          this.config.vae = null;
        }
      },
      immediate: true
    },
    config: {
      handler: function (value) {
        this.$emit('updateConfig', {
          field: 'new_components',
          value
        });
      },
      deep: true
    }
  },
  created() {
    this.cacheConfig = JSON.parse(JSON.stringify(default_data.new_components));

    // 备份 params.new_components.vae
    this.initNewComponentsVae = JSON.parse(JSON.stringify(default_data.new_components.vae));
  },
  methods: {
    initConfig(info) {
      this.config = JSON.parse(JSON.stringify(info.new_components));
      const keysLength = Object.keys(this.config || {}).length;
      this.isOpenNewComponentsConfig = keysLength > 0;
      this.isOpenNewComponentsVaeConfig =
        keysLength > 0 && Object.keys(this.config.vae || {}).length > 0;
    },
    getConfig() {
      return this.config;
    }
  }
};
</script>
<style lang=""></style>
