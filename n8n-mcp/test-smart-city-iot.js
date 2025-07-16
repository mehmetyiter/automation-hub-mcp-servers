import { AIWorkflowGenerator } from './dist/ai-workflow-generator.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function testSmartCityIoT() {
  console.log('=== Akıllı Şehir IoT Otomasyon Testi ===\n');
  
  const generator = new AIWorkflowGenerator({
    apiKey: process.env.ANTHROPIC_API_KEY,
    provider: 'anthropic'
  });
  
  // Yaratıcı IoT senaryosu - Akıllı Şehir Trafik ve Çevre Yönetimi
  const smartCityPrompt = `Akıllı şehir trafik ve çevre yönetim sistemi oluştur:
  
  Sensör Verileri:
  - MQTT üzerinden trafik yoğunluk sensörleri (100+ kavşak)
  - Hava kalitesi sensörleri (PM2.5, CO2, NOx)
  - Gürültü seviyesi ölçümleri
  - Kamera görüntü analizi (plaka tanıma, araç sayımı)
  
  Akıllı Kontroller:
  - Trafik yoğunluğuna göre dinamik ışık süresi ayarlama (GPIO)
  - Hava kirliliği yüksekse alternatif rota önerileri
  - Acil durum araçları için yeşil koridor oluşturma
  - Yaya geçidi sensörleri ile güvenli geçiş kontrolü
  
  Entegrasyonlar:
  - Google Maps API ile gerçek zamanlı trafik durumu
  - Hava durumu API'si ile tahminler
  - Şehir veritabanına anlık veri kayıt (PostgreSQL)
  - ElasticSearch'te arama ve analiz
  
  Bildirimler ve Raporlama:
  - Kritik trafik sıkışıklığında WhatsApp ile trafik polisine bildirim
  - Hava kalitesi tehlikeli seviyede ise vatandaşlara SMS uyarısı
  - Belediye başkanına günlük özet rapor e-postası
  - Web dashboard için WebSocket ile canlı veri akışı
  
  Yapay Zeka:
  - Trafik tahmin modeli ile 1 saat sonraki yoğunluk tahmini
  - Anomali tespiti (kazalar, arızalı sensörler)
  - Optimum trafık akış önerileri
  
  Özel Durumlar:
  - Hafta sonu ve tatil günleri farklı trafik algoritması
  - Okul saatlerinde yaya güvenliği önceliği
  - Etkinlik günlerinde (maç, konser) özel yönlendirme
  - Gece saatlerinde enerji tasarruf modu`;
  
  try {
    console.log('Akıllı şehir workflow\'u oluşturuluyor...\n');
    const startTime = Date.now();
    
    const result = await generator.generateFromPrompt(
      smartCityPrompt, 
      'Smart City Traffic & Environment Management'
    );
    
    const duration = Date.now() - startTime;
    console.log(`\nWorkflow ${duration}ms\'de oluşturuldu\n`);
    
    if (result.success) {
      console.log('✅ Workflow başarıyla oluşturuldu!\n');
      
      // Detaylı analiz
      console.log('=== WORKFLOW ANALİZİ ===\n');
      
      // Node sayıları
      const nodes = result.workflow.nodes || [];
      console.log(`Toplam Node Sayısı: ${nodes.length}`);
      
      // Node tiplerini kategorize et
      const nodeTypes = {};
      nodes.forEach(node => {
        const type = node.type.split('.').pop();
        nodeTypes[type] = (nodeTypes[type] || 0) + 1;
      });
      
      console.log('\nNode Tipleri:');
      Object.entries(nodeTypes).forEach(([type, count]) => {
        console.log(`- ${type}: ${count}`);
      });
      
      // Mapper analizi
      if (result.mapperAnalysis) {
        console.log('\n=== MAPPER ANALİZİ ===');
        console.log('Tespit Edilen Özellikler:');
        result.mapperAnalysis.features.forEach((feature, index) => {
          console.log(`${index + 1}. ${feature}`);
        });
        
        console.log('\nÖnerilen Node\'lar:', result.mapperAnalysis.suggestedNodes.join(', '));
      }
      
      // Validasyon sonuçları
      if (result.workflowValidation) {
        console.log('\n=== VALİDASYON SONUÇLARI ===');
        console.log(`Durum: ${result.workflowValidation.isValid ? '✅ Geçerli' : '❌ Sorunlu'}`);
        
        if (result.workflowValidation.nodeIssues.length > 0) {
          console.log('\nDüzeltilen Node Tipleri:');
          result.workflowValidation.nodeIssues.forEach(issue => {
            if (issue.issues.length > 0) {
              console.log(`- ${issue.node.name}:`);
              issue.issues.forEach(i => console.log(`  • ${i}`));
            }
          });
        }
        
        if (result.workflowValidation.improvements.length > 0) {
          console.log('\nİyileştirme Önerileri:');
          result.workflowValidation.improvements.forEach(imp => {
            console.log(`- ${imp}`);
          });
        }
        
        if (result.workflowValidation.missingCapabilities.length > 0) {
          console.log('\nEksik Yetenekler:');
          result.workflowValidation.missingCapabilities.forEach(cap => {
            console.log(`- ${cap}`);
          });
        }
      }
      
      // Bağlantı analizi
      const connections = result.workflow.connections || {};
      const connectionCount = Object.keys(connections).length;
      console.log(`\nBağlantı Sayısı: ${connectionCount}`);
      
      // Paralel branch tespiti
      let parallelBranches = 0;
      Object.values(connections).forEach((conn) => {
        if (conn.main && conn.main[0] && conn.main[0].length > 1) {
          parallelBranches++;
        }
      });
      console.log(`Paralel Dal Sayısı: ${parallelBranches}`);
      
      // Workflow'u kaydet
      const fs = await import('fs/promises');
      const filename = 'smart-city-iot-workflow.json';
      await fs.writeFile(
        filename, 
        JSON.stringify(result.workflow, null, 2)
      );
      console.log(`\n✅ Workflow '${filename}' dosyasına kaydedildi`);
      
      // Validasyon raporunu da kaydet
      if (result.validationReport) {
        const reportFilename = 'smart-city-validation-report.md';
        await fs.writeFile(reportFilename, result.validationReport);
        console.log(`✅ Validasyon raporu '${reportFilename}' dosyasına kaydedildi`);
      }
      
    } else {
      console.log('❌ Workflow oluşturma başarısız:', result.error);
    }
  } catch (error) {
    console.error('Test hatası:', error);
  }
}

// Testi çalıştır
testSmartCityIoT().catch(console.error);