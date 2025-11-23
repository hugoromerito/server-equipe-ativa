import { db } from './connection.ts'
import { plans } from './schema/billings.ts'

/**
 * Seed inicial para criar planos de assinatura
 */
export async function seedPlans() {
  console.log('🌱 Criando planos de assinatura...')

  const existingPlans = await db.select().from(plans)

  if (existingPlans.length > 0) {
    console.log('⏭️  Planos já existem, pulando seed...')
    return
  }

  await db.insert(plans).values([
    {
      name: 'Gratuito',
      slug: 'free',
      description: 'Plano gratuito para começar',
      price: '0.00',
      interval: 'monthly',
      trial_days: 0,
      features: [
        'Até 5 membros',
        '1 unidade',
        'Até 10 demandas por mês',
        '1 GB de armazenamento',
        'Suporte por email',
      ],
      max_members: 5,
      max_units: 1,
      max_demands: 10,
      max_storage_gb: 1,
      is_active: true,
    },
    {
      name: 'Básico',
      slug: 'basic',
      description: 'Ideal para pequenas equipes',
      price: '49.90',
      interval: 'monthly',
      trial_days: 14,
      features: [
        'Até 20 membros',
        'Até 3 unidades',
        'Até 100 demandas por mês',
        '10 GB de armazenamento',
        'Relatórios básicos',
        'Suporte prioritário',
      ],
      max_members: 20,
      max_units: 3,
      max_demands: 100,
      max_storage_gb: 10,
      is_active: true,
    },
    {
      name: 'Profissional',
      slug: 'professional',
      description: 'Para equipes em crescimento',
      price: '149.90',
      interval: 'monthly',
      trial_days: 14,
      features: [
        'Até 100 membros',
        'Até 10 unidades',
        'Até 1000 demandas por mês',
        '100 GB de armazenamento',
        'Relatórios avançados',
        'Integrações via API',
        'Suporte prioritário 24/7',
        'Treinamento online',
      ],
      max_members: 100,
      max_units: 10,
      max_demands: 1000,
      max_storage_gb: 100,
      is_active: true,
    },
    {
      name: 'Empresarial',
      slug: 'enterprise',
      description: 'Para grandes organizações',
      price: '499.90',
      interval: 'monthly',
      trial_days: 30,
      features: [
        'Membros ilimitados',
        'Unidades ilimitadas',
        'Demandas ilimitadas',
        '1 TB de armazenamento',
        'Relatórios personalizados',
        'API completa',
        'Suporte dedicado 24/7',
        'Treinamento presencial',
        'SLA garantido',
        'Customizações',
      ],
      max_members: null,
      max_units: null,
      max_demands: null,
      max_storage_gb: 1024,
      is_active: true,
    },
  ])

  console.log('✅ Planos criados com sucesso!')
}

// Se executado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  await seedPlans()
  process.exit(0)
}
