// ============================================
// STORAGE WRAPPER
// wraps chrome.storage with less annoying API
// ============================================

import { StorageConfig, QueuedBeat } from './types'



export class Store {
  private cache: Map<string, any> = new Map()
  


  // load config from chrome storage
  async loadConfig(): Promise<StorageConfig> {
    try {
      const result = await chrome.storage.sync.get([
        'apiKey',
        'enabled', 
        'lastSync',
        'totalTime',
        'streak'
      ])
      
      
      const cfg: StorageConfig = {
        apiKey: result.apiKey || '',
        enabled: result.enabled !== false,  // default true
        lastSync: result.lastSync || 0,
        totalTime: result.totalTime || 0,
        streak: result.streak || 0
      }
      
      
      console.log('📦 loaded config:', cfg)
      return cfg
      
    } catch(e) {
      console.error('storage load borked:', e)
      return { enabled: true }  // fallback
    }
  }




  // save config back
  async saveConfig(cfg: Partial<StorageConfig>): Promise<void> {
    try {
      await chrome.storage.sync.set(cfg)
      console.log('💾 saved:', cfg)
    } catch(e) {
      console.error('storage save failed:', e);
    }
  }



  // get heartbeat queue (stored locally)
  async getQueue(): Promise<QueuedBeat[]> {
    try {
      const result = await chrome.storage.local.get('queue')
      const q = result.queue || []
      
      
      console.log(`📬 queue has ${q.length} beats`)
      return q
      
    } catch(e) {
      console.error('queue load fail:', e)
      return []
    }
  }




  // save queue back
  async saveQueue(queue: QueuedBeat[]): Promise<void> {
    try{
      await chrome.storage.local.set({ queue })
      
      console.log(`💌 saved queue: ${queue.length} items`)
    }catch(e){
      console.error('queue save borked:', e)
    }
  }



  // clear old beats from queue
  async pruneQueue(maxAge: number = 86400000): Promise<void> {
    const q = await this.getQueue()
    const now = Date.now()
    
    
    // keep only recent ones
    const fresh = q.filter(qb => (now - qb.queued_at) < maxAge)
    
    
    if(fresh.length < q.length) {
      console.log(`🧹 pruned ${q.length - fresh.length} old beats`)
      await this.saveQueue(fresh)
    }
  }
}
