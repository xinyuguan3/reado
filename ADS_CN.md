# 国内广告接入说明（reado）

## 已实现能力
- 构建脚本支持广告开关与平台选择（当前支持 `wwads`）。
- 默认不注入广告，避免影响现有页面。
- 注入后广告位固定在页面右下角，并带有“广告”标识。

## 环境变量
- `READO_CN_AD_PROVIDER`：广告平台。可选值：`none`（默认）、`wwads`。
- `READO_WWADS_SLOT_ID`：万维广告位 ID（仅 `wwads` 时必填）。

## 构建命令示例
```bash
READO_CN_AD_PROVIDER=wwads \
READO_WWADS_SLOT_ID=你的广告位ID \
npm run build
```

## 回退（关闭广告）
```bash
READO_CN_AD_PROVIDER=none npm run build
```

## 上线前检查
- 大陆正式域名需要先完成 ICP 备案后再投放。
- 在页面中保留广告标识（本项目已在广告位顶部显示“广告”）。
- 若广告平台需要隐私授权或个性化广告开关，需在站点隐私政策中明确说明并提供同意流程。
