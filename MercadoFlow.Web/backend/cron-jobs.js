const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

console.log('🔄 Iniciando sistema de jobs em background...');

// Daily Analytics Job - Every day at 2:00 AM
cron.schedule('0 2 * * *', async () => {
  console.log('📊 Executando job de analytics diárias...');
  try {
    // Import and run daily analytics
    const { DailySalesAnalyticsJob } = require('./dist/src/jobs/DailySalesAnalyticsJob');
    await DailySalesAnalyticsJob.execute();
    console.log('✅ Job de analytics diárias concluída');
  } catch (error) {
    console.error('❌ Erro no job de analytics diárias:', error);
  }
});

// Weekly Market Basket Job - Every Sunday at 3:00 AM
cron.schedule('0 3 * * 0', async () => {
  console.log('🛒 Executando job de market basket semanal...');
  try {
    const { WeeklyMarketBasketJob } = require('./dist/src/jobs/WeeklyMarketBasketJob');
    await WeeklyMarketBasketJob.execute();
    console.log('✅ Job de market basket semanal concluída');
  } catch (error) {
    console.error('❌ Erro no job de market basket:', error);
  }
});

// Monthly Seasonal Analysis - First day of month at 4:00 AM
cron.schedule('0 4 1 * *', async () => {
  console.log('📈 Executando job de análise sazonal mensal...');
  try {
    const { MonthlySeasonalAnalysisJob } = require('./dist/src/jobs/MonthlySeasonalAnalysisJob');
    await MonthlySeasonalAnalysisJob.execute();
    console.log('✅ Job de análise sazonal concluída');
  } catch (error) {
    console.error('❌ Erro no job de análise sazonal:', error);
  }
});

// Alert Generation Job - Every hour
cron.schedule('0 * * * *', async () => {
  console.log('🚨 Executando job de geração de alertas...');
  try {
    const { AlertGenerationJob } = require('./dist/src/jobs/AlertGenerationJob');
    await AlertGenerationJob.execute();
    console.log('✅ Job de geração de alertas concluída');
  } catch (error) {
    console.error('❌ Erro no job de alertas:', error);
  }
});

// Database Cleanup Job - Every day at 1:00 AM
cron.schedule('0 1 * * *', async () => {
  console.log('🧹 Executando job de limpeza do banco...');
  try {
    // Clean old audit logs (older than 90 days)
    await prisma.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        }
      }
    });

    // Clean old completed jobs
    // Add your job cleanup logic here

    console.log('✅ Job de limpeza concluída');
  } catch (error) {
    console.error('❌ Erro no job de limpeza:', error);
  }
});

// Health Check Job - Every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    // Log system metrics
    const memUsage = process.memoryUsage();
    console.log(`💾 Uso de memória: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
  } catch (error) {
    console.error('❌ Health check falhou:', error);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Recebido SIGTERM, finalizando jobs...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Recebido SIGINT, finalizando jobs...');
  await prisma.$disconnect();
  process.exit(0);
});

console.log('✅ Sistema de jobs iniciado com sucesso!');
