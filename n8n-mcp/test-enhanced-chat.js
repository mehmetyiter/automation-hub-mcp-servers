import { AIChatService } from './dist/services/ai-chat-service.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function testEnhancedChat() {
  console.log('=== Testing Enhanced AI Chat Service ===\n');
  
  const chatService = new AIChatService();
  
  // Test message - sipariş yönetimi workflow'u
  const messages = [
    {
      role: 'user',
      content: `Müşteri siparişinden teslimat sonrası takibe kadar tüm süreci yönetecek bir workflow oluşturmak istiyorum. Özellikler:
      - Sipariş alındığında stok kontrolü ve rezervasyon
      - Ödeme işlemi (Stripe, PayPal, kripto paralel kontrol)
      - Anti-fraud kontrolü ve risk skorlaması
      - Depoya pick-pack talimatı gönder
      - Kargo entegrasyonu (DHL, UPS, FedEx seçimi)
      - Müşteriye sipariş durumu SMS ve email bildirimleri
      - Kargo takip numarası ile tracking sayfası oluştur
      - Teslimat sonrası otomatik feedback formu
      - NPS skoru düşükse müşteri hizmetleri ticket'ı
      - Repeat purchase için kişiselleştirilmiş kampanya
      - Tüm süreç boyunca CRM ve ERP senkronizasyonu`
    }
  ];
  
  // Mock provider config
  const providerConfig = {
    provider: 'mock',
    apiKey: 'test-key',
    chat: async (messages) => {
      // Simulate AI response
      return {
        success: true,
        content: `Müşteri siparişinden teslimat sonrasına kadar olan süreci kapsayan workflow için aşağıdaki yapıyı öneriyorum:

### Workflow Özeti
Bu workflow, sipariş alımından teslimat sonrası müşteri takibine kadar tüm süreci otomatikleştirir.

### Node Yapısı
1. Webhook Trigger - Sipariş girişi
2. Stok Kontrolü - HTTP Request
3. Paralel Ödeme İşlemleri
4. Anti-fraud Kontrolü
5. Depo Entegrasyonu
6. Kargo Seçimi ve Entegrasyonu
7. Müşteri Bildirimleri
8. Teslimat Takibi
9. Feedback ve NPS
10. CRM/ERP Güncellemeleri`,
        usage: { tokens: 100 }
      };
    }
  };
  
  try {
    const result = await chatService.processChat(messages, providerConfig);
    
    if (result.success) {
      console.log('✅ Chat processing successful!\n');
      console.log('--- AI Response ---');
      console.log(result.content);
      
      if (result.analysis) {
        console.log('\n--- Analysis Data ---');
        console.log('Features:', result.analysis.features);
        console.log('Suggested Nodes:', result.analysis.suggestedNodes);
        console.log('Tasks:', result.analysis.tasks);
      }
    } else {
      console.log('❌ Chat processing failed:', result.error);
    }
  } catch (error) {
    console.error('Test error:', error);
  }
}

// Test without provider (to see system enhancements)
async function testSystemEnhancements() {
  console.log('\n\n=== Testing System Enhancements Only ===\n');
  
  const chatService = new AIChatService();
  
  // Simple test message
  const messages = [
    {
      role: 'user',
      content: 'YouTube yorumlarını moderasyon için bir sistem kurmak istiyorum'
    }
  ];
  
  // This will fail but show us the enhanced system prompt
  const providerConfig = {
    provider: 'test',
    apiKey: 'none'
  };
  
  try {
    await chatService.processChat(messages, providerConfig);
  } catch (error) {
    console.log('Expected error (no provider), but system analysis should work');
  }
}

// Run tests
console.log('Starting tests...\n');
testEnhancedChat()
  .then(() => testSystemEnhancements())
  .catch(console.error);