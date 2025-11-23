import 'dotenv/config'
import { db } from '../src/db/connection.js'
import { plans } from '../src/db/schema/billings.js'

const initialPlans = [
  {
    name: 'Gratuito',
    slug: 'free',
    description: 'Plano básico gratuito para começar',
    price: '0.00',
    interval: 'monthly' as const,
    trial_days: 0,
    features: [
      'Até 5 membros',
      'Até 2 unidades',
      'Até 50 demandas por mês',
      '1 GB de armazenamento',
      'Suporte por email',
    ],
    max_members: 5,
    max_units: 2,
    max_demands: 50,
    max_storage_gb: 1,
    is_active: true,
  },
  {
    name: 'Básico',
    slug: 'basic',
    description: 'Para pequenas equipes',
    price: '99.00',
    interval: 'monthly' as const,
    trial_days: 14,
    features: [
      'Até 20 membros',
      'Até 5 unidades',
      'Até 200 demandas por mês',
      '10 GB de armazenamento',
      'Suporte prioritário',
      'Relatórios básicos',
    ],
    max_members: 20,
    max_units: 5,
    max_demands: 200,
    max_storage_gb: 10,
    is_active: true,
  },
  {
    name: 'Profissional',
    slug: 'professional',
    description: 'Para equipes em crescimento',
    price: '299.00',
    interval: 'monthly' as const,
    trial_days: 14,
    features: [
      'Até 100 membros',
      'Até 20 unidades',
      'Até 1000 demandas por mês',
      '50 GB de armazenamento',
      'Suporte prioritário 24/7',
      'Relatórios avançados',
      'API access',
      'Webhooks personalizados',
    ],
    max_members: 100,
    max_units: 20,
    max_demands: 1000,
    max_storage_gb: 50,
    is_active: true,
  },
  {
    name: 'Empresarial',
    slug: 'enterprise',
    description: 'Para grandes organizações',
    price: '999.00',
    interval: 'monthly' as const,
    trial_days: 30,
    features: [
      'Membros ilimitados',
      'Unidades ilimitadas',
      'Demandas ilimitadas',
      '500 GB de armazenamento',
      'Suporte dedicado 24/7',
      'Relatórios personalizados',
      'API access completo',
      'Webhooks personalizados',
      'SLA garantido',
      'Treinamento da equipe',
    ],
    max_members: null,
    max_units: null,
    max_demands: null,
    max_storage_gb: 500,
    is_active: true,
  },
]

async function seedPlans() {
  try {
    console.log('🌱 Iniciando seed de planos...')

    // Verifica se já existem planos
    const existingPlans = await db.query.plans.findMany()

    if (existingPlans.length > 0) {
      console.log('⚠️  Planos já existem no banco. Pulando seed.')
      return
    }

    // Insere os planos
    await db.insert(plans).values(initialPlans)

    console.log('✅ Planos criados com sucesso!')
    console.log(`   - ${initialPlans.length} planos inseridos`)

    process.exit(0)
  } catch (error) {
    console.error('❌ Erro ao criar planos:', error)
    process.exit(1)
  }
}

seedPlans()
