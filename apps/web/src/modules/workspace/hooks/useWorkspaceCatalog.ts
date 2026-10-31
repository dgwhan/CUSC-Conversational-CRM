import type {
  WorkspaceConfig,
  PipelineStageConfig,
  ProductItemConfig,
  LeadQualificationCriteria,
} from '../workspaceConfig.types.js';
import { notify } from '../../../components/feedback/toastEmitter.js';

export interface UseWorkspaceCatalogProps {
  config: WorkspaceConfig;
  updateConfig: (patch: Partial<WorkspaceConfig>) => Promise<void>;
}

export const useWorkspaceCatalog = ({ config, updateConfig }: UseWorkspaceCatalogProps) => {
  // Giai đoạn phễu (Pipeline Stages)
  const addStage = async (stage: Omit<PipelineStageConfig, 'id' | 'order'>) => {
    const newId = `stage_${Date.now()}`;
    const newOrder = config.pipelineStages.length;
    const newStage: PipelineStageConfig = {
      ...stage,
      id: newId,
      order: newOrder,
    };
    const updatedStages = [...config.pipelineStages, newStage];
    await updateConfig({ pipelineStages: updatedStages });
  };

  const updateStage = async (stageId: string, patch: Partial<PipelineStageConfig>) => {
    const updatedStages = config.pipelineStages.map((s) =>
      s.id === stageId ? { ...s, ...patch } : s
    );
    await updateConfig({ pipelineStages: updatedStages });
  };

  const deleteStage = async (stageId: string) => {
    if (config.pipelineStages.length <= 2) {
      notify.warning('Phễu phải có tối thiểu 2 giai đoạn.');
      return;
    }
    const updatedStages = config.pipelineStages
      .filter((s) => s.id !== stageId)
      .map((s, idx) => ({ ...s, order: idx }));
    await updateConfig({ pipelineStages: updatedStages });
  };

  const reorderStages = async (sourceIndex: number, destIndex: number) => {
    const nextStages = [...config.pipelineStages];
    const [moved] = nextStages.splice(sourceIndex, 1);
    nextStages.splice(destIndex, 0, moved);
    const reordered = nextStages.map((s, idx) => ({ ...s, order: idx }));
    await updateConfig({ pipelineStages: reordered });
  };

  // Danh mục sản phẩm / Khóa học (Product Catalog)
  const addProduct = async (product: Omit<ProductItemConfig, 'id'>) => {
    const newId = `prod_${Date.now()}`;
    const newProduct: ProductItemConfig = { ...product, id: newId };
    const updatedCatalog = [...config.productCatalog, newProduct];
    await updateConfig({ productCatalog: updatedCatalog });
  };

  const updateProduct = async (productId: string, patch: Partial<ProductItemConfig>) => {
    const updatedCatalog = config.productCatalog.map((p) =>
      p.id === productId ? { ...p, ...patch } : p
    );
    await updateConfig({ productCatalog: updatedCatalog });
  };

  const deleteProduct = async (productId: string) => {
    const updatedCatalog = config.productCatalog.filter((p) => p.id !== productId);
    await updateConfig({ productCatalog: updatedCatalog });
  };

  // Tiêu chí đánh giá khách hàng (Lead Criteria)
  const addCriteria = async (criterion: Omit<LeadQualificationCriteria, 'id'>) => {
    const newId = `crit_${Date.now()}`;
    const newCrit: LeadQualificationCriteria = { ...criterion, id: newId };
    const updatedCriteria = [...config.criteria, newCrit];
    await updateConfig({ criteria: updatedCriteria });
  };

  const updateCriteria = async (criteriaId: string, patch: Partial<LeadQualificationCriteria>) => {
    const updatedCriteria = config.criteria.map((c) =>
      c.id === criteriaId ? { ...c, ...patch } : c
    );
    await updateConfig({ criteria: updatedCriteria });
  };

  const deleteCriteria = async (criteriaId: string) => {
    const updatedCriteria = config.criteria.filter((c) => c.id !== criteriaId);
    await updateConfig({ criteria: updatedCriteria });
  };

  return {
    addStage,
    updateStage,
    deleteStage,
    reorderStages,
    addProduct,
    updateProduct,
    deleteProduct,
    addCriteria,
    updateCriteria,
    deleteCriteria,
  };
};
