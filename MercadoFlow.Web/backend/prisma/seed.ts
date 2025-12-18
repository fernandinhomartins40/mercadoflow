import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean existing data (in development only)
  if (process.env.NODE_ENV === 'development') {
    console.log('🧹 Cleaning existing data...');
    await prisma.alert.deleteMany();
    await prisma.salesAnalytics.deleteMany();
    await prisma.invoiceItem.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.product.deleteMany();
    await prisma.pDV.deleteMany();
    await prisma.market.deleteMany();
    await prisma.user.deleteMany();
    await prisma.industry.deleteMany();
  }

  // Create Admin User
  const hashedPassword = await bcrypt.hash('Admin@123', 12);
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@mercadoflow.com',
      password: hashedPassword,
      name: 'Admin Master',
      role: 'ADMIN',
      isActive: true,
    },
  });
  console.log('✅ Admin user created:', adminUser.email);

  // Create Market Owner
  const marketOwner = await prisma.user.create({
    data: {
      email: 'dono@supermercadoabc.com',
      password: hashedPassword,
      name: 'João Silva',
      role: 'MARKET_OWNER',
      isActive: true,
    },
  });
  console.log('✅ Market owner created:', marketOwner.email);

  // Create Market
  const market = await prisma.market.create({
    data: {
      name: 'Supermercado ABC',
      cnpj: '12345678000199',
      address: 'Rua das Flores, 123',
      city: 'São Paulo',
      state: 'SP',
      region: 'Sudeste',
      ownerId: marketOwner.id,
      planType: 'ADVANCED',
      isActive: true,
    },
  });
  console.log('✅ Market created:', market.name);

  // Update market owner with marketId
  await prisma.user.update({
    where: { id: marketOwner.id },
    data: { marketId: market.id },
  });

  // Create PDV
  const pdv = await prisma.pDV.create({
    data: {
      marketId: market.id,
      name: 'Caixa 01',
      identifier: 'PDV-001',
      isActive: true,
    },
  });
  console.log('✅ PDV created:', pdv.name);

  // Create Products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        ean: '7891000100103',
        name: 'Arroz Branco 5kg',
        category: 'Grãos e Cereais',
        brand: 'Tio João',
        unit: 'KG',
      },
    }),
    prisma.product.create({
      data: {
        ean: '7891000315507',
        name: 'Feijão Preto 1kg',
        category: 'Grãos e Cereais',
        brand: 'Camil',
        unit: 'KG',
      },
    }),
    prisma.product.create({
      data: {
        ean: '7891000244258',
        name: 'Óleo de Soja 900ml',
        category: 'Óleos',
        brand: 'Liza',
        unit: 'UN',
      },
    }),
    prisma.product.create({
      data: {
        ean: '7891000053508',
        name: 'Açúcar Cristal 1kg',
        category: 'Açúcares',
        brand: 'União',
        unit: 'KG',
      },
    }),
    prisma.product.create({
      data: {
        ean: '7891000100110',
        name: 'Macarrão Espaguete 500g',
        category: 'Massas',
        brand: 'Barilla',
        unit: 'UN',
      },
    }),
  ]);
  console.log('✅ Products created:', products.length);

  // Create Sample Invoices (last 30 days)
  const now = new Date();
  const invoicePromises = [];

  for (let i = 0; i < 30; i++) {
    const invoiceDate = new Date(now);
    invoiceDate.setDate(invoiceDate.getDate() - i);

    // Create 2-5 invoices per day
    const invoicesPerDay = Math.floor(Math.random() * 4) + 2;

    for (let j = 0; j < invoicesPerDay; j++) {
      const invoiceNumber = String(1000 + (i * invoicesPerDay) + j).padStart(9, '0');
      const chaveNFe = `35${invoiceNumber}${String(Math.random()).slice(2, 14)}`;

      invoicePromises.push(
        prisma.invoice.create({
          data: {
            chaveNFe,
            marketId: market.id,
            pdvId: pdv.id,
            serie: '001',
            numero: invoiceNumber,
            dataEmissao: invoiceDate,
            cnpjEmitente: market.cnpj!,
            cpfCnpjDestinatario: null,
            valorTotal: 0, // Will be calculated
            rawXmlHash: `hash-${chaveNFe}`,
            documentType: 'NFCE',
            xmlVersion: 'VERSION_400',
            items: {
              create: products.slice(0, Math.floor(Math.random() * 3) + 2).map((product) => {
                const quantity = Math.floor(Math.random() * 5) + 1;
                const unitPrice = Math.random() * 20 + 5;
                const total = quantity * unitPrice;

                return {
                  productId: product.id,
                  codigoEAN: product.ean,
                  codigoInterno: product.ean,
                  descricao: product.name,
                  ncm: '12345678',
                  cfop: '5102',
                  quantidade: quantity,
                  valorUnitario: unitPrice,
                  valorTotal: total,
                };
              }),
            },
          },
        })
      );
    }
  }

  const invoices = await Promise.all(invoicePromises);
  console.log('✅ Sample invoices created:', invoices.length);

  // Update invoice totals
  for (const invoice of invoices) {
    const items = await prisma.invoiceItem.findMany({
      where: { invoiceId: invoice.id },
    });
    const total = items.reduce((sum, item) => sum + item.valorTotal, 0);
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { valorTotal: total },
    });
  }

  // Create Sales Analytics (aggregate last 30 days)
  console.log('✅ Creating sales analytics...');
  for (let i = 0; i < 30; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    for (const product of products) {
      const dayInvoices = await prisma.invoice.findMany({
        where: {
          marketId: market.id,
          dataEmissao: {
            gte: date,
            lt: new Date(date.getTime() + 24 * 60 * 60 * 1000),
          },
        },
        include: {
          items: {
            where: { productId: product.id },
          },
        },
      });

      const quantitySold = dayInvoices.reduce(
        (sum, inv) => sum + inv.items.reduce((s, item) => s + item.quantidade, 0),
        0
      );
      const revenue = dayInvoices.reduce(
        (sum, inv) => sum + inv.items.reduce((s, item) => s + item.valorTotal, 0),
        0
      );
      const transactionCount = dayInvoices.filter((inv) => inv.items.length > 0).length;

      if (quantitySold > 0) {
        await prisma.salesAnalytics.create({
          data: {
            marketId: market.id,
            productId: product.id,
            date,
            quantitySold,
            revenue,
            averagePrice: revenue / quantitySold,
            transactionCount,
          },
        });
      }
    }
  }
  console.log('✅ Sales analytics created');

  // Create Sample Alerts
  await prisma.alert.create({
    data: {
      marketId: market.id,
      type: 'LOW_STOCK',
      title: 'Estoque Baixo - Arroz',
      message: 'O produto Arroz Branco 5kg está com estoque baixo',
      productId: products[0].id,
      priority: 'HIGH',
      isRead: false,
    },
  });

  await prisma.alert.create({
    data: {
      marketId: market.id,
      type: 'HIGH_PERFORMING',
      title: 'Produto Destaque',
      message: 'Óleo de Soja teve aumento de vendas de 45% esta semana',
      productId: products[2].id,
      priority: 'MEDIUM',
      isRead: false,
    },
  });

  console.log('✅ Sample alerts created');

  // Create Industry
  const industry = await prisma.industry.create({
    data: {
      name: 'Indústria Alimentícia XYZ',
      cnpj: '98765432000188',
      segment: 'Alimentos',
      isActive: true,
    },
  });

  // Create Industry User
  const industryUser = await prisma.user.create({
    data: {
      email: 'contato@industriaxyz.com',
      password: hashedPassword,
      name: 'Maria Santos',
      role: 'INDUSTRY_USER',
      industryId: industry.id,
      isActive: true,
    },
  });
  console.log('✅ Industry and user created:', industry.name);

  console.log('🎉 Seed completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`- Users: ${await prisma.user.count()}`);
  console.log(`- Markets: ${await prisma.market.count()}`);
  console.log(`- Products: ${await prisma.product.count()}`);
  console.log(`- Invoices: ${await prisma.invoice.count()}`);
  console.log(`- Sales Analytics: ${await prisma.salesAnalytics.count()}`);
  console.log(`- Alerts: ${await prisma.alert.count()}`);
  console.log('\n🔐 Test Credentials:');
  console.log('Admin: admin@mercadoflow.com / Admin@123');
  console.log('Market Owner: dono@supermercadoabc.com / Admin@123');
  console.log('Industry: contato@industriaxyz.com / Admin@123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
