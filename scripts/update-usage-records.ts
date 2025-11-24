#!/usr/bin/env node

/**
 * Script para atualizar registros de uso de todas as assinaturas ativas
 * Deve ser executado periodicamente via cronjob
 * 
 * Uso:
 *   node --experimental-strip-types scripts/update-usage-records.ts
 * 
 * Cronjob sugerido (1x por hora):
 *   0 * * * * cd /path/to/project && node --experimental-strip-types scripts/update-usage-records.ts
 */

import { usageTrackingService } from '../src/services/usage-tracking.ts'

async function main() {
  console.log('🚀 Iniciando atualização de registros de uso...')
  console.log(`📅 ${new Date().toISOString()}`)
  
  try {
    await usageTrackingService.updateAllActiveSubscriptions()
    console.log('✅ Atualização concluída com sucesso!')
    process.exit(0)
  } catch (error) {
    console.error('❌ Erro na atualização:', error)
    process.exit(1)
  }
}

main()
