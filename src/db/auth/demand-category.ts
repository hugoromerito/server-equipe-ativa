import { z } from 'zod/v4'

export const demandCategorySchema = z.union([
  z.literal('INFRASTRUCTURE'), // Infraestrutura e Serviços Públicos
  z.literal('HEALTH'), // Saúde Pública
  z.literal('EDUCATION'), // Educação e Creches
  z.literal('SOCIAL_ASSISTANCE'), // Assistência Social
  z.literal('PUBLIC_SAFETY'), // Segurança Pública
  z.literal('TRANSPORTATION'), // Transporte e Mobilidade
  z.literal('EMPLOYMENT'), // Emprego e Desenvolvimento Econômico
  z.literal('CULTURE'), // Cultura, Esporte e Lazer
  z.literal('ENVIRONMENT'), // Meio Ambiente e Sustentabilidade
  z.literal('HUMAN_RIGHTS'), // Direitos Humanos e Cidadania
  z.literal('TECHNOLOGY'), // Tecnologia e Inovação
])

export type DemandCategory = z.infer<typeof demandCategorySchema>
