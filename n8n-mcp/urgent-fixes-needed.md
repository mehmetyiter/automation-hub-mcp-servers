# Acil Düzeltmeler Gerekiyor

## Tespit Edilen Sorunlar

### 1. Multi-Step Generation Çok Fazla Node Üretiyor
- **Sorun**: 115 node'luk devasa workflow
- **Sebep**: Her section ayrı ayrı node'lar üretiyor, toplam kontrolü yok
- **Çözüm**: 
  - Section başına node limiti koyulmalı
  - Toplam node sayısı sınırlandırılmalı (max 50-60)

### 2. Provider Post-Processing Uygulanmıyor
- **Sorun**: `applyPostProcessing` method'u tanımlı ama çağrılmıyor olabilir
- **Çözüm**: Workflow generator'larda bu method'un çağrıldığından emin olmalıyız

### 3. Timeout Süreleri Yetersiz
- **Sorun**: 2 dakika (120000ms) büyük workflow'lar için yetersiz
- **Çözüm**:
  - Repair timeout'u 5 dakikaya çıkarılmalı
  - Node sayısına göre dinamik timeout

### 4. Connection Logic Hatalı
- **Sorun**: Multi-step generation'da section'lar arası bağlantılar kurulmuyor
- **Çözüm**: Section merge logic'i düzeltilmeli

## Önerilen Acil Aksiyonlar

### 1. ai-workflow-generator-v3.ts'de Düzeltme
```typescript
// Node limiti ekle
const MAX_NODES_PER_SECTION = 8;
const MAX_TOTAL_NODES = 60;

// Provider post-processing uygula
if (provider.applyPostProcessing) {
  workflow = provider.applyPostProcessing(workflow);
}
```

### 2. Timeout Düzeltmesi
```typescript
// Dynamic timeout based on complexity
const timeoutMs = Math.min(300000, 120000 + (nodeCount * 1000)); // Max 5 min
```

### 3. Section Connection Fix
- Her section'ın ilk node'u önceki section'ın son node'una bağlanmalı
- Section'lar arası merge node'lar eklenmeli

### 4. Validation Enhancement
- Dead-end node'ları otomatik olarak bir sonraki mantıklı node'a bağla
- Boş switch output'larını default branch'e yönlendir