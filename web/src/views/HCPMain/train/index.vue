<template>
  <div class="train-wrapper">
    <div class="train-left">
      <HBlock class="outerWrapperShadow">
        <slot name="changeModel"></slot>
      </HBlock>
      <HBlock class="outerWrapperShadow">
        <div class="btns">
          <el-button
            class="primary-btn"
            type="primary"
            @click="handleTrain"
            v-if="progress === 0 || progress === 100"
          >
            Train
          </el-button>
          <el-button class="interrupt-btn" type="primary" @click="handleInterrupt" v-else>
            Interrupt
          </el-button>
        </div>
        <div class="config-row">
          <el-radio-group v-model="train_mode">
            <el-radio :label="1">with accelerate and only one gpu</el-radio>
            <el-radio :label="0">with accelerate</el-radio>
            <el-radio :label="2">with colossal-AI</el-radio>
          </el-radio-group>
        </div>
      </HBlock>
      <HBlock class="outerWrapperShadow">
        <div class="config-row">
          <HConfigInput label="exp_dir" style="font-size: 13px" disabled v-model="params.exp_dir" />
        </div>
        <div class="config-row">
          <HConfigSelect
            label="mixed_precision"
            style="font-size: 13px"
            :options="dtype_options"
            v-model="params.mixed_precision"
          />
        </div>
        <div class="config-row">
          <HConfigInputNumber label="seed" style="font-size: 13px" :min="1" v-model="params.seed" />
        </div>
        <div class="config-row">
          <HConfigSelect
            label="ckpt_type"
            style="font-size: 13px"
            :options="ckpt_type_options"
            v-model="params.ckpt_type"
          />
        </div>
        <div class="config-row">
          <el-checkbox v-model="params.allow_tf32">allow_tf32</el-checkbox>
        </div>
      </HBlock>
      <HBlock
        class="outerWrapperShadow outerWrapperShadow-other"
        v-if="progress !== 0 && progress !== 100"
      >
        <div class="config-row">
          <p>training progress</p>
        </div>
        <div class="config-row">
          <el-progress type="dashboard" :percentage="progress" :color="colors"></el-progress>
        </div>
      </HBlock>
    </div>

    <div class="train-right">
      <el-tabs v-model="tabName" class="outerWrapperShadow" ref="tabRef">
        <!-- model -->
        <el-tab-pane label="model" name="model">
          <h-collapse title="Model Config">
            <HBlock>
              <div class="config-row">
                <HConfigSelect
                  class="row-style"
                  label="pretrained_model_name_or_path"
                  :options="pretrained_model_name_or_path_options"
                  v-model="params.model.pretrained_model_name_or_path"
                />
                <HConfigInputNumber
                  class="row-style"
                  label="clip_skip"
                  :min="0"
                  :max="4"
                  v-model="params.model.clip_skip"
                />
              </div>
              <div class="config-row">
                <HConfigInputNumber
                  class="row-style"
                  label="ema_text_encoder"
                  :min="0"
                  :max="1"
                  :step="0.01"
                  v-model="params.model.ema_text_encoder"
                />
                <HConfigInputNumber
                  class="row-style"
                  label="ema_unet"
                  :min="0"
                  :max="1"
                  :step="0.01"
                  v-model="params.model.ema_unet"
                />
              </div>
              <div class="config-row">
                <div class="config-row" style="flex: 1">
                  <el-checkbox v-model="params.model.enable_xformers">enable_xformers</el-checkbox>
                  <el-checkbox v-model="params.model.gradient_checkpointing">
                    gradient_checkpointing
                  </el-checkbox>
                </div>
                <HConfigRange
                  label="tokenizer_repeats"
                  :min="1"
                  :max="5"
                  integer
                  v-model="params.model.tokenizer_repeats"
                />
              </div>
            </HBlock>
          </h-collapse>
        </el-tab-pane>

        <!-- tokenizer_pt -->
        <el-tab-pane label="tokenizer_pt" name="tokenizer_pt">
          <h-collapse title="Tokenizer Pt Config">
            <HBlock>
              <div class="config-row">
                <HConfigInput
                  class="row-style"
                  label="emb_dir"
                  disabled
                  v-model="params.tokenizer_pt.emb_dir"
                />
                <div class="config-row" style="flex: 1">
                  <el-checkbox v-model="params.tokenizer_pt.replace">allow_tf32</el-checkbox>
                </div>
              </div>
              <HBlock label="train" :h-index="2" showAdd @onAdd="addTokenizer_ptLogger">
                <template v-if="params.tokenizer_pt.train">
                  <div
                    class="block-style-item block-style-item-flex"
                    v-for="(item, index) in params.tokenizer_pt.train"
                    :key="`${index}-${Math.random()}`"
                  >
                    <div class="config-row">
                      <HConfigSelect
                        class="row-style"
                        label="name"
                        :options="tokenizer_pt_train_name_options"
                        v-model="item.name"
                      />
                      <HConfigInputNumber class="row-style" label="lr" v-model="item.lr" />
                    </div>
                    <i
                      class="icon icon-right el-icon-delete"
                      @click="deleteTokenizer_ptLogger(index)"
                    ></i>
                  </div>
                </template>
              </HBlock>
            </HBlock>
          </h-collapse>
        </el-tab-pane>

        <!-- train -->
        <el-tab-pane label="train" name="train">
          <!-- train -->
          <h-collapse title="Train Config">
            <HBlock>
              <div class="config-row">
                <HConfigInputNumber
                  class="row-style"
                  label="train_steps"
                  :max="1000000"
                  v-model="params.train.train_steps"
                />
                <HConfigInputNumber
                  class="row-style"
                  label="max_grad_norm"
                  disabled
                  v-model="params.train.max_grad_norm"
                />
              </div>
              <div class="config-row">
                <HConfigRange label="workers" :min="0" :max="12" v-model="params.train.workers" />
                <HConfigRange
                  label="gradient_accumulation_steps"
                  :min="1"
                  :max="32"
                  v-model="params.train.gradient_accumulation_steps"
                />
              </div>
              <div class="config-row">
                <el-checkbox v-model="params.train.set_grads_to_none">
                  set_grads_to_none
                </el-checkbox>
                <el-checkbox v-model="params.train.scale_lr_pt">scale_lr_pt</el-checkbox>
                <el-checkbox v-model="params.train.scale_lr">scale_lr</el-checkbox>
              </div>
              <div class="config-row">
                <HConfigInputNumber
                  class="row-style"
                  label="save_step"
                  :max="params.train.train_steps"
                  v-model="params.train.save_step"
                />
                <HConfigInput
                  class="row-style"
                  label="cfg_scale"
                  v-model="params.train.cfg_scale"
                />
              </div>

              <!-- TODO: 讨论后决定 待定 -->
              <!-- <HBlock label="resume">
                  <div class="config-row">暂时无返回值 待处理...</div>
                </HBlock> -->
              <div style="display: flex; gap: 20px">
                <HBlock label="optimizer" :h-index="2">
                  <div class="config-row">
                    <HConfigInputNumber
                      class="row-style"
                      label="weight_decay"
                      :min="0"
                      :max="1"
                      :step="0.001"
                      v-model="params.train.optimizer.weight_decay"
                    />
                  </div>
                </HBlock>
                <HBlock label="optimizer_pt" :h-index="2">
                  <div class="config-row">
                    <HConfigInputNumber
                      class="row-style"
                      label="weight_decay"
                      :min="0"
                      :max="1"
                      :step="0.0001"
                      v-model="params.train.optimizer_pt.weight_decay"
                    />
                  </div>
                </HBlock>
              </div>
              <HBlock label="loss" :h-index="2">
                <div class="config-row">
                  <HConfigSelect
                    label="criterion"
                    class="row-style"
                    :options="lossConfigKeysOptions"
                    v-model="lossConfig"
                  />
                  <HConfigSelect
                    label="type"
                    class="row-style"
                    :options="[
                      { label: 'eps', value: 'eps' },
                      { label: 'sample', value: 'sample' }
                    ]"
                    v-model="params.train.loss.type"
                  />
                </div>
                <div class="config-row">
                  <HConfigRange
                    label="gamma"
                    v-if="lossConfig === 'hcpdiff.loss.MinSNRLoss'"
                    v-model="params.train.loss.criterion.gamma"
                    :min="0.5"
                    :max="10"
                    :step="0.1"
                  />
                </div>
              </HBlock>
              <HBlock label="scheduler" :h-index="2">
                <div class="config-row">
                  <HConfigSelect
                    class="row-style"
                    label="name"
                    :options="scheduler_name_options"
                    v-model="params.train.scheduler.name"
                  />
                  <HConfigInputNumber
                    class="row-style"
                    label="num_warmup_steps"
                    :min="0"
                    :max="params.train.train_steps"
                    v-model="params.train.scheduler.num_warmup_steps"
                  />
                </div>
                <div class="config-row">
                  <HConfigInputNumber
                    class="row-style"
                    label="num_training_steps"
                    :default-value="params.train.train_steps"
                    v-model="params.train.scheduler.num_training_steps"
                  />
                </div>
                <HBlock :h-index="3" label="scheduler_kwargs">
                  <EditWordName
                    title="编辑scheduler_kwargs"
                    :value="params.train.scheduler.scheduler_kwargs"
                    @confirm="(e) => confirmChangeSchedulerKwargs(e, 'scheduler')"
                  />
                </HBlock>
              </HBlock>
              <HBlock label="scheduler_pt" :h-index="2">
                <div class="config-row">
                  <HConfigSelect
                    class="row-style"
                    label="name"
                    :options="scheduler_name_options"
                    v-model="params.train.scheduler_pt.name"
                  />
                  <HConfigInputNumber
                    class="row-style"
                    label="num_warmup_steps"
                    :min="0"
                    :max="params.train.train_steps"
                    v-model="params.train.scheduler_pt.num_warmup_steps"
                  />
                </div>
                <div class="config-row">
                  <HConfigInputNumber
                    class="row-style"
                    label="num_training_steps"
                    :default-value="params.train.train_steps"
                    v-model="params.train.scheduler_pt.num_training_steps"
                  />
                </div>
                <HBlock :h-index="3" label="scheduler_kwargs">
                  <EditWordName
                    title="编辑scheduler_kwargs"
                    :value="params.train.scheduler_pt.scheduler_kwargs"
                    @confirm="(e) => confirmChangeSchedulerKwargs(e, 'scheduler_pt')"
                  />
                </HBlock>
              </HBlock>
            </HBlock>
          </h-collapse>
        </el-tab-pane>

        <!-- unet -->
        <el-tab-pane label="unet" name="unet">
          <h-collapse
            title="Unet Config"
            showSwitch
            :showAdd="isOpenUnetCollapse"
            v-model="isOpenUnetCollapse"
            @onSwitch="handleUnetCollapseChange"
            @add="addUnet"
          >
            <HBlock
              :h-index="2"
              label=" "
              show-icon
              v-for="(item, unet_index) in params.unet || []"
              :key="`${unet_index}-${Math.random()}`"
              @onDelete="deleteUnet(unet_index)"
            >
              <div class="config-row" style="margin-top: 10px">
                <HConfigInputNumber
                  class="row-style"
                  :min="0"
                  :max="1"
                  :step="0.000001"
                  label="lr"
                  v-model="item.lr"
                />
                <HConfigTagSelect
                  label="layers"
                  class="row-style"
                  v-model="item.layers"
                  :options="[]"
                />
              </div>
            </HBlock>
          </h-collapse>
        </el-tab-pane>

        <!-- text_encoder -->
        <el-tab-pane label="text_encoder" name="text_encoder">
          <h-collapse
            title="Text Encoder Config"
            showSwitch
            :showAdd="isOpenTextEncoderCollapse"
            v-model="isOpenTextEncoderCollapse"
            @onSwitch="handleTextEncoderCollapseChange"
            @add="addTextEncoder"
          >
            <div
              class="block-style-item"
              v-for="(item, unet_index) in params.text_encoder || []"
              :key="`${unet_index}-${Math.random()}`"
            >
              <HBlock :h-index="2" label=" " show-icon @onDelete="deleteTextEncoder(unet_index)">
                <div class="config-row">
                  <HConfigInputNumber
                    class="row-style"
                    :min="0"
                    :max="1"
                    :step="0.000001"
                    label="lr"
                    v-model="item.lr"
                  />
                  <HConfigTagSelect
                    class="row-style"
                    label="layers"
                    v-model="item.layers"
                    :options="[]"
                  />
                </div>
              </HBlock>
            </div>
          </h-collapse>
        </el-tab-pane>

        <!-- lora_unet -->
        <el-tab-pane label="lora_unet" name="lora_unet">
          <h-collapse
            title="Lora Unet Config"
            showSwitch
            :showAdd="isOpenLoraUnetCollapse"
            v-model="isOpenLoraUnetCollapse"
            @onSwitch="handleLoraUnetCollapseChange"
            @add="addLora_unet"
          >
            <div
              class="block-style-item"
              v-for="(item, index) in params.lora_unet || []"
              :key="index"
            >
              <HBlock label=" " :h-index="2" show-icon @onDelete="deleteLora_unet(index)">
                <div class="config-row">
                  <HConfigInputNumber
                    class="row-style"
                    label="lr"
                    :min="0"
                    :max="1"
                    :step="0.0001"
                    v-model="item.lr"
                  />
                  <div class="config-row" style="flex: 1">
                    <el-checkbox v-model="item.bias">bias</el-checkbox>
                  </div>
                </div>
                <div class="config-row">
                  <HConfigTagSelect
                    class="row-style"
                    label="layers"
                    v-model="item.layers"
                    :options="[
                      're:.*\\.resnets$',
                      're:.*\\.proj_in$',
                      're:.*\\.proj_out$',
                      're:.*\\.conv$',
                      're:.*\\.attn.?$',
                      're:.*\\.ff$'
                    ]"
                  />
                  <HConfigInputNumber
                    class="row-style"
                    label="rank"
                    :min="1"
                    :max="100"
                    v-model="item.rank"
                  />
                </div>
                <div class="config-row">
                  <HConfigSelect
                    class="row-style"
                    label="branch"
                    clearable
                    isAllowNull
                    :options="[
                      { label: 'null', value: null },
                      { label: 'p', value: 'p' },
                      { label: 'n', value: 'n' }
                    ]"
                    v-model="item.branch"
                  />
                  <HConfigInputNumber class="row-style" label="dropout" v-model="item.dropout" />
                </div>
              </HBlock>
            </div>
          </h-collapse>
        </el-tab-pane>

        <!-- lora_text_encoder -->
        <el-tab-pane label="lora_text_encoder" name="lora_text_encoder">
          <h-collapse
            title="Lora Text Encoder Config"
            showSwitch
            :showAdd="isOpenLoraTextEncoderCollapse"
            v-model="isOpenLoraTextEncoderCollapse"
            @onSwitch="handleLoraTextEncoderCollapseChange"
            @add="addLora_text_encoder"
          >
            <HBlock
              :h-index="2"
              label=" "
              v-for="(item, index) in params.lora_text_encoder || []"
              :key="`${index}-${Math.random()}`"
              showIcon
              @onDelete="deleteLora_text_encoder(index)"
            >
              <div class="config-row">
                <HConfigInputNumber
                  class="row-style"
                  :min="0"
                  :max="1"
                  :step="0.000001"
                  label="lr"
                  v-model="item.lr"
                />
                <HConfigInputNumber class="row-style" label="rank" v-model="item.rank" />
              </div>
              <div class="config-row">
                <HConfigInputNumber
                  class="row-style"
                  :min="0"
                  :max="1"
                  :step="0.1"
                  label="dropout"
                  v-model="item.dropout"
                />
                <HConfigSelect
                  class="row-style"
                  label="branch"
                  isAllowNull
                  :options="[
                    { label: 'null', value: null },
                    { label: 'p', value: 'p' },
                    { label: 'n', value: 'n' }
                  ]"
                  v-model="item.branch"
                />
              </div>
              <div class="config-row">
                <HConfigTagSelect
                  class="row-style"
                  label="layers"
                  v-model="item.layers"
                  :options="[]"
                />
              </div>
            </HBlock>
          </h-collapse>
        </el-tab-pane>

        <!-- plugin_unet -->
        <el-tab-pane label="plugin_unet" name="plugin_unet">
          <h-collapse
            title="Plugin Unet Config"
            showSwitch
            :showAdd="isOpenPluginUnetCollapse"
            v-model="isOpenPluginUnetCollapse"
            @onSwitch="handlePluginUnetCollapseChange"
            @add="addPluginUnet"
          >
            <HBlock
              :h-index="2"
              :label="plugin"
              v-for="plugin in pluginUnetList"
              :key="plugin"
              :show-icon="true"
              showEditKey
              @onEditKey="editPluginUnetKey"
              @onDelete="deletePluginUnet(plugin)"
            >
              <div class="config-row">
                <el-checkbox v-model="params.plugin_unet[plugin]._partial_">_partial_</el-checkbox>
              </div>
              <div class="config-row">
                <HConfigInput
                  class="row-style"
                  disabled
                  label="_target_"
                  v-model="params.plugin_unet[plugin]._target_"
                />
                <HConfigInputNumber
                  class="row-style"
                  label="lr"
                  v-model="params.plugin_unet[plugin].lr"
                />
              </div>
              <div class="config-row">
                <HConfigTagSelect
                  class="row-style"
                  label="from_layers"
                  v-model="params.plugin_unet[plugin].from_layers"
                  :options="['pre_hook:', 'pre_hook:conv_in']"
                />
              </div>
              <div class="config-row">
                <HConfigTagSelect
                  class="row-style"
                  label="to_layers"
                  v-model="params.plugin_unet[plugin].to_layers"
                  :options="[
                    'down_blocks.0',
                    'down_blocks.1',
                    'down_blocks.2',
                    'down_blocks.3',
                    'mid_block',
                    'pre_hook:up_blocks.3.resnets.2'
                  ]"
                />
              </div>
            </HBlock>
          </h-collapse>
        </el-tab-pane>

        <!-- plugin_TE -->
        <el-tab-pane label="plugin_TE" name="plugin_TE">
          <h-collapse
            title="Plugin TE Config"
            showSwitch
            :showAdd="isOpenPluginTeCollapse"
            v-model="isOpenPluginTeCollapse"
            @onSwitch="handlePluginTeCollapseChange"
            @add="addPluginTe"
          >
            <HBlock
              :h-index="2"
              :label="plugin"
              v-for="plugin in pluginTeList"
              :key="plugin"
              :show-icon="true"
              showEditKey
              @onEditKey="editPluginTeKey"
              @onDelete="deletePluginTe(plugin)"
            >
              <div class="config-row">
                <el-checkbox v-model="params.plugin_TE[plugin]._partial_">_partial_</el-checkbox>
              </div>
              <div class="config-row">
                <HConfigInput
                  class="row-style"
                  disabled
                  label="_target_"
                  v-model="params.plugin_TE[plugin]._target_"
                />
                <HConfigInputNumber
                  class="row-style"
                  label="lr"
                  v-model="params.plugin_TE[plugin].lr"
                />
              </div>
              <div class="config-row">
                <HConfigTagSelect
                  label="from_layers"
                  class="row-style"
                  v-model="params.plugin_TE[plugin].from_layers"
                  :options="['pre_hook:', 'pre_hook:conv_in']"
                />
              </div>
              <div class="config-row">
                <HConfigTagSelect
                  label="to_layers"
                  class="row-style"
                  v-model="params.plugin_TE[plugin].to_layers"
                  :options="[
                    'down_blocks.0',
                    'down_blocks.1',
                    'down_blocks.2',
                    'down_blocks.3',
                    'mid_block',
                    'pre_hook:up_blocks.3.resnets.2'
                  ]"
                />
              </div>
            </HBlock>
          </h-collapse>
        </el-tab-pane>

        <!-- data -->
        <el-tab-pane label="data" name="data">
          <h-collapse
            class="data-collapse-wrapper"
            title="Data Config"
            showAdd
            showPre
            showNext
            :nextDisabled="datasetIndex === datasetList.length - 1"
            :preDisabled="datasetIndex === 0"
            @add="addDateset"
            @pre="handlerPreDataset"
            @next="handlerNextDataset"
          >
            <HBlock>
              <!-- dataset1 -->
              <template v-if="datasetList && datasetList.length">
                <el-carousel
                  ref="dataCarouselRef"
                  :autoplay="false"
                  :initial-index="datasetIndex"
                  arrow="never"
                  :height="`${tabHeight}px`"
                >
                  <el-carousel-item
                    v-for="(dataset, index) in datasetList"
                    :key="`${index}-${Math.random()}`"
                    @scroll.native="saveScrollPosition(index)"
                  >
                    <HBlock
                      :h-index="2"
                      :label="dataset"
                      :ref="`dataset-${index}`"
                      :show-icon="datasetList.length > 1"
                      @onDelete="deleteDataset(dataset)"
                    >
                      <div class="config-row">
                        <HConfigInput
                          class="row-style"
                          label="_target_"
                          disabled
                          v-model="params.data[dataset]._target_"
                        />
                        <div class="config-row" style="flex: 1">
                          <el-checkbox v-model="params.data[dataset].cache_latents">
                            cache_latents
                          </el-checkbox>
                          <el-checkbox v-model="params.data[dataset].att_mask_encode">
                            att_mask_encode
                          </el-checkbox>
                        </div>
                      </div>
                      <div class="config-row">
                        <HConfigInputNumber
                          class="row-style"
                          label="batch_size"
                          :min="1"
                          :max="100"
                          v-model="params.data[dataset].batch_size"
                        />
                        <HConfigInputNumber
                          class="row-style"
                          label="loss_weight"
                          :min="0"
                          :max="10"
                          :step="0.01"
                          v-model="params.data[dataset].loss_weight"
                        />
                      </div>
                      <!-- bucket -->
                      <HBlock label="bucket" :h-index="3">
                        <div class="config-row">
                          <HConfigSelect
                            class="row-style"
                            label="_target_"
                            :options="bucket__target__options"
                            v-model="params.data[dataset].bucket._target_"
                            @onChange="(e) => handlerBucketTargetChange(dataset, e)"
                          />
                          <template
                            v-if="
                              params.data[dataset].bucket._target_ ===
                              'hcpdiff.data.bucket.RatioBucket.from_files'
                            "
                          >
                            <HConfigRange
                              label="num_bucket"
                              :min="1"
                              :max="10"
                              v-model="params.data[dataset].bucket.num_bucket"
                            />
                          </template>
                          <div
                            class="config-row"
                            v-if="
                              params.data[dataset].bucket._target_ ===
                                'hcpdiff.data.bucket.FixedBucket' &&
                              params.data[dataset].bucket.target_size
                            "
                          >
                            <HConfigInputNumber
                              label="target_size"
                              class="row-style"
                              v-model="params.data[dataset].bucket.target_size[0]"
                            />
                            <HConfigInputNumber
                              v-model="params.data[dataset].bucket.target_size[1]"
                            />
                          </div>
                        </div>
                        <HBlock
                          :h-index="4"
                          label="target_area"
                          v-if="
                            params.data[dataset].bucket._target_ ===
                              'hcpdiff.data.bucket.RatioBucket.from_files' &&
                            params.data[dataset].bucket.target_area
                          "
                        >
                          <div class="config-row">
                            <HConfigInput
                              class="row-style"
                              label="_target_"
                              v-model="params.data[dataset].bucket.target_area._target_"
                            />
                            <HConfigInputSum
                              class="row-style"
                              label="_args_"
                              v-model="params.data[dataset].bucket.target_area._args_"
                            />
                          </div>
                        </HBlock>
                      </HBlock>
                      <!-- source -->
                      <HBlock
                        label="source"
                        :h-index="3"
                        showAdd
                        @onAdd="addDataSourceData_source(dataset)"
                      >
                        <!-- data_source1\ data_source2 -->
                        <HBlock
                          style="position: relative"
                          :h-index="4"
                          v-for="{ source, key } in dataSourceList(dataset)"
                          :label="source"
                          :key="key"
                          :show-icon="dataSourceList(dataset).length > 1"
                          @onDelete="deleteDataSourceData_source(dataset, source)"
                        >
                          <div class="config-row">
                            <HConfigInput
                              class="row-style"
                              label="img_root"
                              v-model="params.data[dataset].source[source].img_root"
                            />
                            <HConfigInput
                              class="row-style"
                              label="att_mask"
                              v-model="params.data[dataset].source[source].att_mask"
                            />
                          </div>
                          <div class="config-row">
                            <HConfigSelect
                              class="row-style"
                              label="prompt_template"
                              :options="prompt_template_options"
                              v-model="params.data[dataset].source[source].prompt_template"
                            />
                            <HConfigInput
                              class="row-style"
                              label="caption_file"
                              type="file"
                              v-model="params.data[dataset].source[source].caption_file"
                            />
                          </div>

                          <!-- image_transforms -->
                          <HBlock
                            :h-index="5"
                            class="image-transforms"
                            label="image_transforms"
                            show-add
                            @onAdd="addImgTransforms(dataset, source)"
                            @onSwitch="(e) => handleImgTransformsChange(dataset, source, e)"
                          >
                            <template
                              v-if="params.data[dataset].source[source].image_transforms.transforms"
                            >
                              <HBlock
                                style="margin-top: 10px"
                                v-for="(item, index) in params.data[dataset].source[source]
                                  .image_transforms.transforms || []"
                                :key="item._target_ + index"
                                :h-index="6"
                                :label="`transforms-${index}`"
                                :showIcon="
                                  params.data[dataset].source[source].image_transforms.transforms
                                    .length > 1
                                "
                                @onDelete="deleteImgTransforms(dataset, source, index)"
                              >
                                <div class="config-row">
                                  <HConfigSelect
                                    class="row-style"
                                    label="_target_"
                                    :options="imgTransformsConfig"
                                    v-model="item._target_"
                                    @onChange="
                                      (e) => handlerChangeImgTransforms(dataset, source, index, e)
                                    "
                                  />
                                  <template
                                    v-if="
                                      [
                                        'torchvision.transforms.Resize',
                                        'torchvision.transforms.CenterCrop',
                                        'torchvision.transforms.RandomCrop'
                                      ].includes(item._target_)
                                    "
                                  >
                                    <HConfigTagSelect
                                      class="row-style"
                                      label="size"
                                      v-model="item.size"
                                    />
                                  </template>
                                  <template
                                    v-if="
                                      item._target_ === 'torchvision.transforms.RandomGrayscale'
                                    "
                                  >
                                    <HConfigInputNumber
                                      class="row-style"
                                      label="p"
                                      :min="0"
                                      :max="1"
                                      :step="0.01"
                                      v-model="item.p"
                                    />
                                  </template>
                                </div>

                                <template
                                  v-if="item._target_ === 'torchvision.transforms.Normalize'"
                                >
                                  <div class="config-row">
                                    <HConfigTagSelect
                                      class="row-style"
                                      label="mean"
                                      v-model="item.mean"
                                    />
                                    <HConfigTagSelect
                                      class="row-style"
                                      label="std"
                                      v-model="item.std"
                                    />
                                  </div>
                                </template>
                                <template
                                  v-if="item._target_ === 'torchvision.transforms.ColorJitter'"
                                >
                                  <div class="config-row">
                                    <HConfigTagSelect
                                      class="row-style"
                                      label="brightness"
                                      v-model="item.brightness"
                                    />
                                    <HConfigTagSelect
                                      class="row-style"
                                      label="contrast"
                                      v-model="item.contrast"
                                    />
                                  </div>
                                </template>
                                <template
                                  v-if="item._target_ === 'torchvision.transforms.ColorJitter'"
                                >
                                  <div class="config-row">
                                    <HConfigTagSelect
                                      class="row-style"
                                      label="saturation"
                                      v-model="item.saturation"
                                    />
                                    <HConfigTagSelect
                                      class="row-style"
                                      label="hue"
                                      v-model="item.hue"
                                    />
                                  </div>
                                </template>
                                <template
                                  v-if="item._target_ === 'torchvision.transforms.GaussianBlur'"
                                >
                                  <div class="config-row">
                                    <HConfigTagSelect
                                      class="row-style"
                                      label="kernel_size"
                                      v-model="item.kernel_size"
                                    />
                                    <HConfigTagSelect
                                      class="row-style"
                                      label="sigma"
                                      v-model="item.sigma"
                                    />
                                  </div>
                                </template>
                              </HBlock>
                            </template>
                          </HBlock>

                          <!-- tag_transforms -->
                          <HBlock
                            :h-index="5"
                            label="tag_transforms"
                            showAdd
                            @onAdd="addTagTransforms(dataset, source)"
                          >
                            <template
                              v-if="params.data[dataset].source[source].tag_transforms.transforms"
                            >
                              <HBlock
                                v-for="(transforms, transforms_index) in params.data[dataset]
                                  .source[source].tag_transforms.transforms || []"
                                :key="transforms._target_ + transforms_index"
                                :h-index="6"
                                style="margin-top: 10px"
                                :label="`transforms-${transforms_index}`"
                                :showIcon="
                                  params.data[dataset].source[source].tag_transforms.transforms
                                    .length > 1
                                "
                                @onDelete="deleteTagTransforms(dataset, source, transforms_index)"
                              >
                                <div class="config-row">
                                  <HConfigSelect
                                    class="row-style"
                                    label="_target_"
                                    :options="tagTransformsConfig"
                                    v-model="transforms._target_"
                                    @onChange="
                                      (e) =>
                                        handlerChangeTagTransforms(
                                          dataset,
                                          source,
                                          transforms_index,
                                          e
                                        )
                                    "
                                  />
                                  <template
                                    v-if="
                                      transforms._target_ ===
                                      'hcpdiff.utils.caption_tools.TagDropout'
                                    "
                                  >
                                    <HConfigInputNumber
                                      class="row-style"
                                      label="p"
                                      :min="0"
                                      :max="1"
                                      :step="0.01"
                                      v-model="transforms.p"
                                    />
                                  </template>
                                </div>
                                <HBlock
                                  label="word_names"
                                  :h-index="7"
                                  v-if="
                                    transforms._target_ ===
                                    'hcpdiff.utils.caption_tools.TemplateFill'
                                  "
                                >
                                  <EditWordName
                                    :value="transforms.word_names"
                                    @confirm="
                                      (e) =>
                                        confirmChangeWordName(dataset, source, transforms_index, e)
                                    "
                                  />
                                </HBlock>
                              </HBlock>
                            </template>
                          </HBlock>
                        </HBlock>
                      </HBlock>
                    </HBlock>
                  </el-carousel-item>
                </el-carousel>
              </template>
            </HBlock>
          </h-collapse>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>
<script>
import EditWordName from './components/editWordName.vue';
import {
  default_train_data,
  ckpt_type_options,
  optimizer_types_options,
  scheduler_name_options,
  bucket__target__options,
  word_names_pt1_options,
  dtype_options,
  lossConfigKeys,
  lossConfigs,
  default_lora_text_encoder_value,
  img_transformsConfigKeys,
  tag_transformsConfigKeys,
  tag_transformsConfigKeysOptions,
  STATUS_TYPE,
  lora_unet_default_value
} from '@/constants/index';

import { getTrain, updateTrain, getTrainStatus, stopTrain } from '@/api/train';
import { mapGetters } from 'vuex';
import { handleOptions } from '@/utils/index';
import { merge, isEmpty } from 'lodash-es';
export default {
  name: 'HTrain',
  components: {
    EditWordName
  },
  props: {
    yaml_template_sn: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      tabName: 'model',
      imgs: [],
      ckpt_type_options,
      optimizer_types_options,
      scheduler_name_options,
      bucket__target__options,
      word_names_pt1_options,
      prompt_template_options: [],
      tokenizer_pt_train_name_options: [],
      pretrained_model_name_or_path_options: [],
      dtype_options,
      params: JSON.parse(JSON.stringify(default_train_data)),
      disabled: false,
      progress: 0,
      timer: null,
      // 训练类型
      train_mode: 1,

      lossConfigKeysOptions: lossConfigKeys,
      lossConfig: '',

      datasetList: [],

      colors: [
        { color: '#f56c6c', percentage: 20 },
        { color: '#e6a23c', percentage: 40 },
        { color: '#5cb87a', percentage: 60 },
        { color: '#1989fa', percentage: 80 },
        { color: '#6f7ad3', percentage: 100 }
      ],

      isOpenUnetCollapse: false,
      isOpenTextEncoderCollapse: false,
      isOpenPluginUnetCollapse: false,
      isOpenPluginTeCollapse: false,
      isOpenLoraUnetCollapse: false,
      isOpenDataCollapse: false,
      isOpenLoraTextEncoderCollapse: false,
      tabHeight: 1000,

      scrollPosition: 0,
      currentIndex: 0,

      isOpenImgTransforms: false,

      datasetIndex: 0
    };
  },
  watch: {
    lossConfig(val) {
      this.params.train.loss.criterion = lossConfigs[val];
    },
    params: {
      handler(val) {
        this.datasetList = Object.keys(val.data);
      },
      immediate: true,
      deep: true
    },
    'params.data': {
      handler: function (val) {
        if (val) {
          this.restScrollPosition();
        }
      },
      deep: true
    }
  },
  computed: {
    ...mapGetters(['trainSn']),
    getDatasetName({ datasetList }) {
      const length = datasetList.length;
      let datasetName = `dataset${length + 1}`;
      if (datasetList.includes(datasetName)) {
        datasetName = `dataset${length + 2}`;
      }
      return datasetName;
    },
    pluginTeList() {
      const data = this.params.plugin_TE;
      const keys = Object.keys(data || {});
      return keys;
    },
    pluginTeName({ pluginTeList }) {
      const length = pluginTeList.length;
      return `controlnet${length + 1}`;
    },
    pluginUnetList() {
      const data = this.params.plugin_unet;
      const keys = Object.keys(data || {});
      return keys;
    },
    pluginUnetName({ pluginUnetList }) {
      const length = pluginUnetList.length;
      return `controlnet${length + 1}`;
    },
    imgTransformsConfig() {
      return Object.keys(img_transformsConfigKeys).map((key) => {
        return {
          key,
          row: img_transformsConfigKeys[key],
          label: key,
          value: key
        };
      });
    },
    tagTransformsConfig() {
      return handleOptions(tag_transformsConfigKeysOptions);
    }
  },
  created() {
    this.initDefaultData();
  },
  mounted() {
    if (this.$refs.tabRef) {
      this.tabHeight = this.$refs.tabRef.$el.offsetHeight - 174;
    }
  },
  methods: {
    handlerBucketTargetChange(dataset, e) {
      if (e === 'hcpdiff.data.bucket.RatioBucket.from_files') {
        this.$delete(this.params.data[dataset].bucket, 'target_size');
        this.$set(this.params.data[dataset].bucket, 'target_area', {
          _target_: 'builtins.eval',
          _args_: ['512*512']
        });
        this.$set(this.params.data[dataset].bucket, 'num_bucket', 1);
      } else if (e === 'hcpdiff.data.bucket.FixedBucket') {
        this.$delete(this.params.data[dataset].bucket, 'target_area');
        this.$delete(this.params.data[dataset].bucket, 'num_bucket');
        this.$set(this.params.data[dataset].bucket, 'target_size', [512, 512]);
      }
      this.$forceUpdate();
    },
    handleImgTransformsChange(dataset, source, val) {
      if (val) {
        if (!this.params.data[dataset].source[source].image_transforms.transforms) {
          this.params.data[dataset].source[source].image_transforms.transforms = [
            JSON.parse(JSON.stringify(img_transformsConfigKeys['torchvision.transforms.Normalize']))
          ];
        }
      } else {
        this.params.data[dataset].source[source].image_transforms.transforms = null;
      }
    },
    async handleInterrupt() {
      const result = await stopTrain(this.trainSn).catch(() => {
        this.$message.error('interrupt failed');
      });
      if (!result) return;
      const { status } = result;
      this.progress = 0;
      this.$message.success('interrupt succeeded');
      if (status !== STATUS_TYPE.ACTIVE_INTERRUPT) {
        this.$emit('onMessage', status);
      }
    },
    async handleTrain() {
      if (this.disabled) return;
      this.disabled = true;
      const info = this.handleParams();
      const result = await updateTrain({ info, train_mode: this.train_mode }).catch((err) => {
        this.$message.error(err || 'train failed');
        this.disabled = false;
      });
      if (!result) return;
      const { sn } = result;

      this.$store.commit('setTrainSnSn', sn);
      this.getTrainStatus();
    },
    // 轮询获取进度
    async getTrainStatus() {
      const result = await getTrainStatus({ sn: this.trainSn }).catch(() => {
        this.$message.error('get training progress failed');
      });
      if (!result) return;
      const { progress, status } = result;
      // 定时轮询 1s
      if (progress < 100) {
        this.timer = setTimeout(() => this.getTrainStatus(), 5000);
        this.progress = progress;
      } else {
        if (status === STATUS_TYPE.END) {
          this.$message.success('train succeeded');
        }
        this.disabled = false;
        this.progress = 0;
      }
      this.$emit('onMessage', status);
    },
    handleParams() {
      const {
        isOpenUnetCollapse,
        isOpenTextEncoderCollapse,
        isOpenPluginUnetCollapse,
        isOpenPluginTeCollapse,
        isOpenLoraUnetCollapse,
        isOpenDataCollapse,
        isOpenLoraTextEncoderCollapse
      } = this;
      const params = JSON.parse(JSON.stringify(this.params));
      if (!isOpenUnetCollapse) {
        params.unet = null;
      }
      if (!isOpenTextEncoderCollapse) {
        params.text_encoder = null;
      }
      if (!isOpenPluginUnetCollapse) {
        params.plugin_unet = null;
      }
      if (!isOpenPluginTeCollapse) {
        params.plugin_TE = null;
      }
      if (!isOpenLoraUnetCollapse) {
        params.lora_unet = null;
      }
      if (!isOpenDataCollapse) {
        params.data = null;
      }
      if (!isOpenLoraTextEncoderCollapse) {
        params.lora_text_encoder = null;
      }
      return params;
    },
    confirmChangeSchedulerKwargs(value, key) {
      this.$set(this.params.train[key], 'scheduler_kwargs', value);
    },
    handlerPreDataset() {
      if (this.datasetList.length <= 0) return;
      this.datasetIndex -= 1;
      this.$refs.dataCarouselRef.prev();
    },
    handlerNextDataset() {
      if (this.datasetList.length <= 0) return;
      this.datasetIndex += 1;
      this.$refs.dataCarouselRef.next();
    },
    handleUnetCollapseChange(val) {
      if (val && !this.params.unet) {
        this.addUnet();
      }
    },
    handleTextEncoderCollapseChange(val) {
      if (val && !this.params.text_encoder) {
        this.addTextEncoder();
      }
    },
    handlePluginUnetCollapseChange(val) {
      if (val && !this.params.plugin_unet) {
        this.addPluginUnet();
      }
    },
    handlePluginTeCollapseChange(val) {
      if (val && !this.params.plugin_TE) {
        this.addPluginTe();
      }
    },
    handleLoraUnetCollapseChange(val) {
      if (val && !this.params.lora_unet) {
        this.addLora_unet();
      }
    },
    handleLoraTextEncoderCollapseChange(val) {
      if (val && !this.params.lora_text_encoder) {
        this.addLora_text_encoder();
      }
    },
    confirmChangeWordName(dataset, source, index, value) {
      this.$set(
        this.params.data[dataset].source[source].tag_transforms.transforms[index],
        'word_names',
        value
      );
      this.$forceUpdate();
    },
    handlerChangeTagTransforms(dataset, source, index, key) {
      switch (key) {
        case 'hcpdiff.utils.caption_tools.TagShuffle':
          this.$delete(
            this.params.data[dataset].source[source].tag_transforms.transforms[index],
            'p'
          );
          this.$delete(
            this.params.data[dataset].source[source].tag_transforms.transforms[index],
            'word_names'
          );
          break;
        case 'hcpdiff.utils.caption_tools.TagDropout':
          this.$set(
            this.params.data[dataset].source[source].tag_transforms.transforms[index],
            'p',
            0.1
          );
          this.$delete(
            this.params.data[dataset].source[source].tag_transforms.transforms[index],
            'word_names'
          );
          break;
        case 'hcpdiff.utils.caption_tools.TemplateFill':
          this.$set(
            this.params.data[dataset].source[source].tag_transforms.transforms[index],
            'word_names',
            {}
          );
          this.$delete(
            this.params.data[dataset].source[source].tag_transforms.transforms[index],
            'p'
          );
          break;
      }
      this.$forceUpdate();
    },
    addTagTransforms(dataset, source) {
      if (!this.params.data[dataset].source[source].tag_transforms.transforms) {
        this.$set(this.params.data[dataset].source[source].tag_transforms, 'transforms', []);
      }
      this.params.data[dataset].source[source].tag_transforms.transforms.push(
        tag_transformsConfigKeys['hcpdiff.utils.caption_tools.TagShuffle']
      );
      this.$forceUpdate();
    },
    deleteTagTransforms(dataset, source, index) {
      this.params.data[dataset].source[source].tag_transforms.transforms.splice(index, 1);
      if (this.params.data[dataset].source[source].tag_transforms.transforms.length === 0) {
        this.$set(this.params.data[dataset].source[source].tag_transforms, 'transforms', null);
      }
      this.$forceUpdate();
    },
    handlerChangeImgTransforms(dataset, source, index, key) {
      const newConfig = JSON.parse(JSON.stringify(img_transformsConfigKeys[key]));
      this.$set(
        this.params.data[dataset].source[source].image_transforms.transforms,
        index,
        newConfig
      );
      this.$forceUpdate();
    },
    addImgTransforms(dataset, source) {
      if (!this.params.data[dataset].source[source].image_transforms.transforms) {
        this.$set(this.params.data[dataset].source[source].image_transforms, 'transforms', []);
      }
      this.params.data[dataset].source[source].image_transforms.transforms.push(
        JSON.parse(JSON.stringify(img_transformsConfigKeys['torchvision.transforms.Normalize']))
      );
      this.$forceUpdate();
    },
    deleteImgTransforms(dataset, source, index) {
      this.params.data[dataset].source[source].image_transforms.transforms.splice(index, 1);
      if (this.params.data[dataset].source[source].image_transforms.transforms.length === 0) {
        this.$set(this.params.data[dataset].source[source].image_transforms, 'transforms', null);
      }
      this.$forceUpdate();
    },
    dataSourceList(dataset) {
      const data = this.params.data[dataset].source;
      const keys = Object.keys(data);
      return keys.map((key) => {
        return {
          source: key,
          key: Math.random()
        };
      });
    },
    dataSourceName(dataset) {
      const length = this.dataSourceList(dataset).length;
      return `data_source${length + 1}`;
    },
    addUnetLayers(unet_index) {
      this.params.unet[unet_index].layers.push(
        JSON.parse(JSON.stringify(default_train_data.unet[0].layers[0]))
      );
    },
    deleteUnetLayers(unet_index, index) {
      this.params.unet[unet_index].layers.splice(index, 1);
    },
    addUnet() {
      if (!this.params.unet) {
        this.params.unet = [];
      }
      this.params.unet.push(JSON.parse(JSON.stringify(default_train_data.unet[0])));
    },
    deleteUnet(unet_index) {
      this.params.unet.splice(unet_index, 1);
      if (this.params.unet && this.params.unet.length === 0) {
        this.$set(this.params, 'unet', null);
        this.isOpenUnetCollapse = false;
      }
    },
    addTextEncoder() {
      if (!this.params.text_encoder) {
        this.params.text_encoder = [];
      }
      this.params.text_encoder.push(JSON.parse(JSON.stringify(default_train_data.text_encoder[0])));
    },
    deleteTextEncoder(index) {
      this.params.text_encoder.splice(index, 1);
      if (this.params.text_encoder && this.params.text_encoder.length === 0) {
        this.$set(this.params, 'text_encoder', null);
        this.isOpenTextEncoderCollapse = false;
      }
    },
    addLora_text_encoder() {
      if (!this.params.lora_text_encoder) {
        this.params.lora_text_encoder = [];
      }
      this.params.lora_text_encoder.push(
        JSON.parse(JSON.stringify(default_lora_text_encoder_value))
      );
    },
    deleteLora_text_encoder(index) {
      this.params.lora_text_encoder.splice(index, 1);
      if (this.params.lora_text_encoder && this.params.lora_text_encoder.length === 0) {
        this.$set(this.params, 'lora_text_encoder', null);
        this.isOpenLoraTextEncoderCollapse = false;
      }
    },
    addPluginUnet() {
      if (!this.params.plugin_unet) {
        this.$set(this.params, 'plugin_unet', {});
      }
      this.$set(
        this.params.plugin_unet,
        this.pluginUnetName,
        JSON.parse(JSON.stringify(default_train_data.plugin_unet.controlnet1))
      );
    },
    deletePluginUnet(pluginUnetName) {
      this.$delete(this.params.plugin_unet, pluginUnetName);
      if (Object.keys(this.params.plugin_unet).length === 0) {
        this.$set(this.params, 'plugin_unet', null);
        this.isOpenPluginUnetCollapse = false;
      }
    },
    addPluginTe() {
      if (!this.params.plugin_TE) {
        this.$set(this.params, 'plugin_TE', {});
      }
      this.$set(
        this.params.plugin_TE,
        this.pluginTeName,
        JSON.parse(JSON.stringify(default_train_data.plugin_TE.controlnet1))
      );
    },
    deletePluginTe(pluginTeName) {
      this.$delete(this.params.plugin_TE, pluginTeName);
      if (Object.keys(this.params.plugin_TE).length === 0) {
        this.$set(this.params, 'plugin_TE', null);
        this.isOpenPluginTeCollapse = false;
      }
    },
    editPluginUnetKey({ oldKeyName, newKeyName }) {
      const oldData = JSON.parse(JSON.stringify(this.params.plugin_unet[oldKeyName]));
      this.$delete(this.params.plugin_unet, oldKeyName);
      this.$set(this.params.plugin_unet, newKeyName, oldData);
    },
    editPluginTeKey({ oldKeyName, newKeyName }) {
      const oldData = JSON.parse(JSON.stringify(this.params.plugin_TE[oldKeyName]));
      this.$delete(this.params.plugin_TE, oldKeyName);
      this.$set(this.params.plugin_TE, newKeyName, oldData);
    },
    addLogger() {
      this.params.logger.push(JSON.parse(JSON.stringify(default_train_data.logger[0])));
      this.$forceUpdate();
    },
    deleteLogger(index) {
      this.params.logger.splice(index, 1);
      this.$forceUpdate();
    },
    addTokenizer_ptLogger() {
      if (!this.params.tokenizer_pt.train) {
        this.$set(this.params.tokenizer_pt, 'train', []);
      }
      this.params.tokenizer_pt.train.push(
        JSON.parse(JSON.stringify(default_train_data.tokenizer_pt.train[0]))
      );
      this.$forceUpdate();
    },
    deleteTokenizer_ptLogger(index) {
      this.params.tokenizer_pt.train.splice(index, 1);
      if (this.params.tokenizer_pt.train.length === 0) {
        this.$set(this.params.tokenizer_pt, 'train', null);
      }
    },
    addLora_unet() {
      if (!this.params.lora_unet) {
        this.$set(this.params, 'lora_unet', []);
      }
      this.params.lora_unet.push(JSON.parse(JSON.stringify(lora_unet_default_value)));
      this.$forceUpdate();
    },
    deleteLora_unet(index) {
      this.params.lora_unet.splice(index, 1);
      if (this.params.lora_unet.length === 0) {
        this.$set(this.params, 'lora_unet', null);
        this.isOpenLoraUnetCollapse = false;
      }
    },
    addDateset() {
      if (!this.params.data) {
        this.$set(this.params, 'data', {});
      }
      this.$set(
        this.params.data,
        this.getDatasetName,
        JSON.parse(JSON.stringify(default_train_data.data.dataset1))
      );
      this.$forceUpdate();
    },
    deleteDataset(dataset) {
      this.$delete(this.params.data, dataset);
      const length = Object.keys(this.params.data).length;
      if (length === 0) {
        this.$set(this.params, 'data', null);
        this.isOpenDatasetCollapse = false;
      }
      if (this.datasetIndex > length - 1) {
        this.datasetIndex = length - 1;
      }
      this.$forceUpdate();
    },
    addDataSourceData_source(dataset) {
      if (!this.params.data[dataset].source) {
        this.$set(this.params.data[dataset], 'source', {});
      }
      this.$set(
        this.params.data[dataset].source,
        this.dataSourceName(dataset),
        JSON.parse(JSON.stringify(default_train_data.data.dataset1.source.data_source1))
      );
      this.$forceUpdate();
    },
    deleteDataSourceData_source(dataset, source) {
      this.$delete(this.params.data[dataset].source, source);
      this.$forceUpdate();
    },
    addImage_transformsTransforms(dataset, source) {
      this.params.data[dataset].source[source].image_transforms.transforms.push(
        JSON.parse(
          JSON.stringify(
            default_train_data.data[dataset].source.data_source1.image_transforms.transforms[0]
          )
        )
      );
    },
    deleteImage_transformsTransforms(dataset, source, index) {
      this.params.data[dataset].source[source].image_transforms.transforms.splice(index, 1);
    },
    async initDefaultData() {
      const result = await getTrain(this.trainSn).catch((err) => {
        this.$message.error(err);
      });
      if (!result) return;
      const {
        info,
        is_pending,
        progress,
        pretrained_mode = [],
        pretrained_model_name_or_path = [],
        prompt_template = [],
        tokenizer_pt_train_name = [],
        server_yaml_file = []
      } = result;
      const newInfo = JSON.parse(JSON.stringify(info));
      this.$set(this, 'params', JSON.parse(JSON.stringify(default_train_data)));
      this.$set(this, 'params', merge(this.params, info));
      if (!isEmpty(info)) {
        const { unet, text_encoder, plugin_unet, plugin_TE, lora_unet, data, lora_text_encoder } =
          newInfo;
        this.isOpenUnetCollapse = !!unet;
        this.isOpenTextEncoderCollapse = !!text_encoder;
        this.isOpenPluginUnetCollapse = !!plugin_unet;
        this.isOpenPluginTeCollapse = !!plugin_TE;
        this.isOpenLoraUnetCollapse = !!lora_unet;
        this.isOpenDataCollapse = !!data;
        this.isOpenLoraTextEncoderCollapse = !!lora_text_encoder;
        this.initDataTransforms(newInfo);
      }
      if (Object.keys(info).length) {
        const { train } = info;
        const { loss } = train || {};
        this.lossConfig =
          loss && loss.criterion ? loss.criterion._target_ : 'hcpdiff.loss.MinSNRLoss';
      } else {
        this.lossConfig = 'hcpdiff.loss.MinSNRLoss';
      }

      this.prompt_template_options = handleOptions(prompt_template);
      this.tokenizer_pt_train_name_options = handleOptions(tokenizer_pt_train_name);
      this.pretrained_model_name_or_path_options = handleOptions(pretrained_model_name_or_path);
      this.disabled = is_pending;
      this.progress = progress;
      if (is_pending) {
        this.getTrainStatus();
      }
      this.$emit('getPretrainedMode', {
        options: handleOptions(pretrained_mode),
        server_yaml_file,
        files: 'train_server_yaml_file_options',
        valueFiles: 'train_yaml_template_sn'
      });
    },

    saveScrollPosition(index) {
      this.currentIndex = index;
      const carouselEl = this.$refs[`dataset-${index}`][0].$el;
      const wrapperEl = carouselEl.parentNode;
      this.scrollPosition = wrapperEl.scrollTop;
    },
    restScrollPosition() {
      this.$nextTick(() => {
        if (!this.$refs[`dataset-${this.currentIndex}`]) return;
        const carouselEl = this.$refs[`dataset-${this.currentIndex}`][0].$el;
        const wrapperEl = carouselEl.parentNode;
        wrapperEl.scrollTop = this.scrollPosition;
      });
    },

    initDataTransforms(newInfo) {
      if (!isEmpty(newInfo.data)) return;
      Object.keys(newInfo.data).forEach((dataset) => {
        const { source } = newInfo.data[dataset];
        Object.keys(source).forEach((sourceName) => {
          const { image_transforms, tag_transforms } = source[sourceName];
          // image_transforms 存在 transforms存在或长度为0
          if (
            !image_transforms ||
            !image_transforms.transforms ||
            image_transforms.transforms.length === 0
          ) {
            this.$set(this.params.data[dataset].source[sourceName], 'image_transforms', {
              _target_: 'torchvision.transforms.Compose',
              transforms: [
                {
                  _target_: 'torchvision.transforms.ToTensor'
                }
              ]
            });
          }

          // tag_transforms 存在 tag_transforms存在或长度为0
          if (
            !tag_transforms ||
            !tag_transforms.transforms ||
            tag_transforms.transforms.length === 0
          ) {
            this.$set(this.params.data[dataset].source[sourceName], 'tag_transforms', {
              _target_: 'torchvision.transforms.Compose',
              transforms: [
                {
                  _target_: 'hcpdiff.utils.caption_tools.TagShuffle'
                }
              ]
            });
          }
        });
      });
    }
  },
  beforeDestroy() {
    clearTimeout(this.timer);
  }
};
</script>

<style lang="scss" scoped>
::v-deep .el-tabs .el-tabs__header .el-tabs__item {
  padding: 0 10px !important;
}

.train-wrapper {
  width: 100%;
  height: 100%;
  @include flexLayout(row, 0);
  .train-left {
    flex: 1.5;
    padding: 20px;
    box-sizing: border-box;
    .outerWrapperShadow + .outerWrapperShadow {
      margin-top: 20px;
    }
    .el-radio + .el-radio {
      margin-top: 14px;
    }
    .interrupt-btn {
      width: 100%;
      height: 100%;
      border: 1px solid #b9c0cb !important;
      color: #3b414f !important;
      background: #b9c0cb !important;
    }
    .el-progress {
      width: 100%;
    }
  }
  .train-right {
    height: 100%;
    flex: 5;
    padding: 20px;
    box-sizing: border-box;
    .el-tabs {
      height: 100%;
      border-radius: 10px;
      @include flexLayout(column, 0);
      .el-tabs__nav {
        display: flex;
        flex-wrap: wrap;
      }
      ::v-deep .el-tabs__content {
        flex: 1;
        overflow-y: scroll;
        height: 100%;
        .el-tab-pane {
          min-height: 100%;
          .data-collapse-wrapper {
            height: 100%;
            .el-carousel__item {
              overflow-y: scroll;
            }
            .image-transforms {
              .tip {
                justify-content: flex-start;
              }
            }
          }
        }
        .el-collapse-item__wrap {
          border-radius: 0 0 10px 10px;
          overflow: inherit !important;
        }
      }
    }
  }
}
.outerWrapperShadow-other {
  @include flexLayout(column, 0, center, center);
}
</style>

<style lang="scss">
.transforms-carousel {
  overflow-x: initial;
  .el-carousel__arrow {
    top: -16px;
    background: transparent;
    color: #409eff;
    cursor: pointer;
    & > i {
      font-size: 16px;
    }
  }
  .el-carousel__arrow--left {
    left: 156px;
  }
  .el-carousel__arrow--right {
    right: auto;
    left: 194px;
  }
}
</style>
