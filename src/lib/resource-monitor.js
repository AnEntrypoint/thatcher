import os from 'os'
import fs from 'fs'
import { recordResource } from '@/lib/metrics-collector.js'

let monitoringInterval = null
let dbPath = null

function getCPUUsage() {
  const cpus = os.cpus()
  let totalIdle = 0
  let totalTick = 0

  cpus.forEach(cpu => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type]
    }
    totalIdle += cpu.times.idle
  })

  const idle = totalIdle / cpus.length
  const total = totalTick / cpus.length
  const usage = 1 - (idle / total)

  return Math.max(0, Math.min(1, usage))
}

function getMemoryUsage() {
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const usedMem = totalMem - freeMem

  return {
    total: totalMem,
    used: usedMem,
    free: freeMem,
    percentage: usedMem / totalMem
  }
}

function getDiskUsage() {
  if (!dbPath) return null

  try {
    const stats = fs.statSync(dbPath)
    const totalSpace = 1024 * 1024 * 1024 * 100
    const usedSpace = stats.size

    return {
      total: totalSpace,
      used: usedSpace,
      percentage: usedSpace / totalSpace
    }
  } catch (err) {
    return null
  }
}

function collectResources() {
  try {
    const cpu = getCPUUsage()
    const memory = getMemoryUsage()
    const disk = getDiskUsage()

    recordResource(
      cpu,
      memory.percentage,
      disk?.percentage
    )

    return { cpu, memory, disk }
  } catch (err) {
    console.error('[ResourceMonitor] Collection error:', err)
    return null
  }
}

function startMonitoring(interval = 5000, databasePath = null) {
  if (monitoringInterval) {
    stopMonitoring()
  }

  dbPath = databasePath

  monitoringInterval = setInterval(() => {
    collectResources()
  }, interval)

}

function stopMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval)
    monitoringInterval = null
  }
}

function getCurrentResources() {
  return collectResources()
}

export {
  getCPUUsage,
  getMemoryUsage,
  getDiskUsage,
  collectResources,
  startMonitoring,
  stopMonitoring,
  getCurrentResources
}

if (typeof globalThis !== 'undefined') {
  globalThis.__resources = {
    getCurrentResources,
    startMonitoring,
    stopMonitoring
  }
}
