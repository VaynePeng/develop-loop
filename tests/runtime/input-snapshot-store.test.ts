import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  InputSnapshotStore,
  InputSnapshotStoreError,
  calculateFileSha256
} from '../../src/runtime/input-snapshot-store'

describe('InputSnapshotStore', () => {
  let projectRoot = ''
  let uploadsDirectory = ''
  let store: InputSnapshotStore

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'develop-loop-snapshot-'))
    uploadsDirectory = join(projectRoot, 'uploads')
    store = new InputSnapshotStore(projectRoot)

    await mkdir(uploadsDirectory)
  })

  afterEach(async () => {
    await rm(projectRoot, {
      recursive: true,
      force: true
    })
  })

  it('把附件复制到稳定的 inputs 路径并返回哈希', async () => {
    const sourcePath = join(uploadsDirectory, 'product-prd.md')
    await writeFile(sourcePath, '# 产品需求\n', 'utf8')

    const result = await store.snapshot('prd', sourcePath)

    expect(result.requestPath).toBe(
      '.develop-loop/inputs/prd/product-prd.md'
    )
    expect(await readFile(result.snapshotPath, 'utf8')).toBe('# 产品需求\n')
    expect(result.sha256).toBe(await calculateFileSha256(sourcePath))
  })

  it('相同附件重复导入时复用同一快照', async () => {
    const sourcePath = join(uploadsDirectory, 'product-prd.md')
    await writeFile(sourcePath, '# 产品需求\n', 'utf8')

    const first = await store.snapshot('prd', sourcePath)
    const second = await store.snapshot('prd', sourcePath)

    expect(second).toEqual(first)
  })

  it('同名但内容不同的附件保留独立版本', async () => {
    const firstDirectory = join(uploadsDirectory, 'first')
    const secondDirectory = join(uploadsDirectory, 'second')
    await mkdir(firstDirectory)
    await mkdir(secondDirectory)

    const firstPath = join(firstDirectory, 'product-prd.md')
    const secondPath = join(secondDirectory, 'product-prd.md')
    await writeFile(firstPath, '# 第一版\n', 'utf8')
    await writeFile(secondPath, '# 第二版\n', 'utf8')

    const first = await store.snapshot('prd', firstPath)
    const second = await store.snapshot('prd', secondPath)

    expect(second.requestPath).not.toBe(first.requestPath)
    expect(second.requestPath).toMatch(
      /^\.develop-loop\/inputs\/prd\/product-prd-[a-f0-9]{12}\.md$/
    )
    expect(await readFile(first.snapshotPath, 'utf8')).toBe('# 第一版\n')
    expect(await readFile(second.snapshotPath, 'utf8')).toBe('# 第二版\n')
  })

  it('拒绝把目录当成附件快照', async () => {
    await expect(store.snapshot('prd', uploadsDirectory))
      .rejects.toBeInstanceOf(InputSnapshotStoreError)
  })
})
