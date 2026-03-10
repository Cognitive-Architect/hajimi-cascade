/**
 * entropy.ts - B-01: 香农熵计算工具 (≤80行)
 * 计算字节流的香农熵，输出归一化到[0,1]
 */

/**
 * 计算字节频率分布
 * @param data - 输入字节流
 * @returns 256长度的频率数组
 */
function calculateByteFrequency(data: Buffer): number[] {
  const freq = new Array(256).fill(0);
  for (let i = 0; i < data.length; i++) {
    freq[data[i]]++;
  }
  return freq.map(count => count / data.length);
}

/**
 * 计算香农熵 (Shannon Entropy)
 * 输出范围 [0, 1]，基于每字节最大熵8位
 * @param data - 输入字节流
 * @returns 归一化熵值 [0,1]
 */
export function calculateEntropy(data: Buffer): number {
  if (data.length === 0) return 0;
  
  const frequencies = calculateByteFrequency(data);
  let entropy = 0;
  
  for (const p of frequencies) {
    if (p > 0) {
      // Shannon entropy: -sum(p * log2(p))
      entropy -= p * Math.log2(p);
    }
  }
  
  // 归一化到 [0, 1]，最大熵为8位/字节
  return Math.min(1, Math.max(0, entropy / 8));
}

/**
 * 计算滑动窗口熵值流
 * @param data - 输入字节流
 * @param windowSize - 窗口大小
 * @returns 每个位置的局部熵值数组
 */
export function calculateEntropyStream(data: Buffer, windowSize: number): number[] {
  if (data.length === 0) return [];
  if (data.length <= windowSize) return [calculateEntropy(data)];
  
  const entropies: number[] = [];
  for (let i = 0; i <= data.length - windowSize; i++) {
    const window = data.subarray(i, i + windowSize);
    entropies.push(calculateEntropy(window));
  }
  return entropies;
}

/**
 * 快速熵估计（基于采样）
 * 用于大数据的近似熵计算
 * @param data - 输入字节流
 * @param sampleSize - 采样大小
 * @returns 估计熵值 [0,1]
 */
export function estimateEntropy(data: Buffer, sampleSize: number = 1024): number {
  if (data.length === 0) return 0;
  if (data.length <= sampleSize) return calculateEntropy(data);
  
  // 均匀采样
  const step = Math.floor(data.length / sampleSize);
  const samples = Buffer.allocUnsafe(sampleSize);
  for (let i = 0; i < sampleSize; i++) {
    samples[i] = data[i * step];
  }
  return calculateEntropy(samples);
}

export default { calculateEntropy, calculateEntropyStream, estimateEntropy };
