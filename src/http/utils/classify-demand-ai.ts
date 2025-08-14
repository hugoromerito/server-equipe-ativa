import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'
import {
  type DemandCategoryType,
  type DemandPriorityType,
  demandCategoryZodEnum,
  demandPriorityZodEnum,
} from '../../db/schema/enums.ts'

interface ClassifyDemandAiParams {
  description: string
}

export async function classifyDemandAi({
  description,
}: ClassifyDemandAiParams) {
  const categoryOptions = demandCategoryZodEnum.options
  const priorityOptions = demandPriorityZodEnum.options

  const categoryList = categoryOptions.map((cat) => `- ${cat}`).join('\n')
  const priorityList = priorityOptions.map((prio) => `- ${prio}`).join('\n')

  const answer = await generateText({
    model: openai('gpt-4o'),
    prompt: description,
    system: `
Você é um classificador de demandas. A partir da descrição fornecida, retorne apenas um objeto JSON com os seguintes campos:

{
  "category": string,
  "priority": string
}

Use **apenas** os valores exatos abaixo.

Categorias (campo category):
${categoryList}

Prioridades (campo priority):
${priorityList}

Responda apenas com o JSON. Não adicione nenhum texto explicativo (sem incluir \`\`\` no início ou no fim).
`.trim(),
  })

  try {
    const result = JSON.parse(answer.text)

    // Verificação para garantir que o retorno é válido
    if (!categoryOptions.includes(result.category)) {
      throw new Error('Categoria inválida')
    }
    if (!priorityOptions.includes(result.priority)) {
      throw new Error('Prioridade inválida')
    }

    return {
      category: result.category as DemandCategoryType,
      priority: result.priority as DemandPriorityType,
    }
  } catch (_error) {
    // console.error('Erro ao interpretar resposta da IA:', answer.text)
    throw new Error('A resposta da IA não está em um formato válido.')
  }
}
