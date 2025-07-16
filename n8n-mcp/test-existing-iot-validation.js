import { WorkflowValidationService } from './dist/services/workflow-validation-service.js';
import { PromptToWorkflowMapper } from './dist/planning/prompt-to-workflow-mapper.js';
import { readFile } from 'fs/promises';

async function testExistingIoTValidation() {
  console.log('=== Mevcut IoT Workflow Validasyon Testi ===\n');
  
  const validationService = new WorkflowValidationService();
  const promptMapper = new PromptToWorkflowMapper();
  
  // Önce yeni bir yaratıcı IoT senaryosu analiz edelim
  const creativeParkingPrompt = `Akıllı otopark yönetim sistemi:
  
  Sensörler ve Veri Toplama:
  - Her park yerinde ultrasonik sensör (dolu/boş tespiti)
  - Giriş/çıkış kapılarında plaka okuma kameraları
  - CO seviyesi sensörleri (havalandırma kontrolü)
  - Nem ve sıcaklık sensörleri
  
  Dinamik Fiyatlandırma:
  - Doluluk oranına göre fiyat ayarlama
  - Özel günlerde (maç, konser) premium fiyat
  - Abonelere indirim sistemi
  - Elektrikli araçlara özel tarife
  
  Ödeme ve Rezervasyon:
  - QR kod ile temassız ödeme
  - Mobil uygulama ile ön rezervasyon
  - Kredi kartı, kripto para kabul
  - Fatura otomasyonu
  
  Güvenlik ve Acil Durum:
  - Yangın sensörleri ve otomatik sprinkler aktivasyonu
  - Acil durum anonsları ve yönlendirme ışıkları
  - Güvenlik kamerası anomali tespiti
  - Araç hırsızlığı alarmı
  
  Müşteri Deneyimi:
  - LED yönlendirme ile boş yer gösterimi
  - Araç konumu hatırlatma (hangi katta park edildi)
  - Vale hizmeti entegrasyonu
  - Elektrikli araç şarj istasyonu yönetimi`;
  
  try {
    // 1. Prompt Analizi
    console.log('1. Yaratıcı Senaryo Analizi\n');
    const analysis = await promptMapper.analyzePrompt(creativeParkingPrompt);
    
    console.log('Tespit Edilen Özellikler:');
    analysis.features.forEach((feature, index) => {
      console.log(`${index + 1}. ${feature.name} (Güven: ${feature.confidence})`);
    });
    
    console.log('\nÖnerilen Node\'lar:', analysis.suggestedNodes.join(', '));
    console.log('Toplam Görev Sayısı:', analysis.tasks.length);
    
    // 2. Mevcut workflow'u yükle ve doğrula
    console.log('\n\n2. Mevcut IoT Workflow Validasyonu\n');
    
    const iotWorkflow = JSON.parse(
      await readFile('/home/mehmet/Documents/n8nMCP/Automating Irrigation and Climate Control.json', 'utf-8')
    );
    
    console.log(`Workflow: ${iotWorkflow.name}`);
    console.log(`Node Sayısı: ${iotWorkflow.nodes.length}`);
    
    // 3. Validasyon
    const validationResult = await validationService.validateWorkflow(iotWorkflow);
    
    console.log('\n=== VALİDASYON SONUÇLARI ===');
    console.log(`Durum: ${validationResult.isValid ? '✅ Geçerli' : '❌ Sorunlar Var'}`);
    console.log(`Node Sorunları: ${validationResult.nodeIssues.length}`);
    console.log(`Workflow Sorunları: ${validationResult.workflowIssues.length}`);
    console.log(`İyileştirme Önerileri: ${validationResult.improvements.length}`);
    console.log(`Eksik Yetenekler: ${validationResult.missingCapabilities.length}`);
    
    // 4. Düzeltilen node'ları göster
    if (validationResult.nodeIssues.length > 0) {
      console.log('\n=== DÜZELTİLEN NODE TİPLERİ ===');
      const corrections = {};
      
      validationResult.nodeIssues.forEach(issue => {
        issue.issues.forEach(issueText => {
          if (issueText.includes('Should be')) {
            const match = issueText.match(/Invalid node type '(.+)'\. Should be '(.+)'/);
            if (match) {
              corrections[match[1]] = match[2];
            }
          }
        });
      });
      
      Object.entries(corrections).forEach(([wrong, correct]) => {
        console.log(`❌ ${wrong} → ✅ ${correct}`);
      });
    }
    
    // 5. Eksik parametreleri göster
    console.log('\n=== EKSİK PARAMETRELER ===');
    validationResult.nodeIssues.forEach(issue => {
      if (issue.requiredParameters.length > 0) {
        console.log(`\n${issue.node.name} (${issue.node.type}):`);
        issue.requiredParameters.forEach(param => {
          console.log(`  - ${param}`);
        });
      }
    });
    
    // 6. İyileştirme önerilerini detaylandır
    if (validationResult.improvements.length > 0) {
      console.log('\n=== İYİLEŞTİRME ÖNERİLERİ ===');
      validationResult.improvements.forEach((improvement, index) => {
        console.log(`${index + 1}. ${improvement}`);
      });
    }
    
    // 7. Bağlantı sorunlarını göster
    const disconnectedNodes = validationResult.nodeIssues.filter(issue => 
      issue.issues.some(i => i.includes('not connected'))
    );
    
    if (disconnectedNodes.length > 0) {
      console.log('\n=== BAĞLANTI SORUNLARI ===');
      disconnectedNodes.forEach(node => {
        console.log(`- ${node.node.name}: Bağlantısı yok`);
      });
    }
    
    // 8. Validasyon raporunu oluştur
    const report = validationService.generateValidationReport(validationResult);
    
    // Raporu kaydet
    const fs = await import('fs/promises');
    await fs.writeFile('iot-validation-report.md', report);
    console.log('\n✅ Detaylı validasyon raporu "iot-validation-report.md" dosyasına kaydedildi');
    
    // 9. Yaratıcı senaryo için öneriler
    console.log('\n\n=== YARATİCİ SENARYO İÇİN ÖNERİLER ===');
    console.log('Akıllı otopark sistemi için gereken ek node\'lar:');
    
    const parkingSpecificNodes = [
      'n8n-nodes-base.qrCode - QR kod oluşturma/okuma',
      'n8n-nodes-base.stripe - Ödeme işlemleri',
      'n8n-nodes-base.redis - Gerçek zamanlı park yeri durumu',
      'n8n-nodes-base.websocket - Canlı durum güncellemeleri',
      'n8n-nodes-base.twilio - SMS ile konum hatırlatma',
      'n8n-nodes-base.schedule - Dinamik fiyat güncellemeleri'
    ];
    
    parkingSpecificNodes.forEach(node => {
      console.log(`- ${node}`);
    });
    
  } catch (error) {
    console.error('Test hatası:', error);
  }
}

// Testi çalıştır
testExistingIoTValidation().catch(console.error);