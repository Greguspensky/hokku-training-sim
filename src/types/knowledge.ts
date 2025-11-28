/**
 * Knowledge Base Type Definitions
 * Categories, documents, topics, and questions
 */

export type ItemType = 'menu_item' | 'add_on' | 'sop' | 'info';

export type FileType = 'text' | 'pdf' | 'doc' | 'docx' | 'txt';

export interface KnowledgeBaseCategory {
  id: string;
  company_id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  document_count?: number;
}

export interface KnowledgeBaseDocument {
  id: string;
  company_id: string;
  category_id: string;
  title: string;
  content: string;
  item_type: ItemType;
  file_url?: string;
  file_type: FileType;
  file_size?: number;
  created_at: string;
  updated_at: string;
  category?: KnowledgeBaseCategory;
}

export interface CreateCategoryData {
  name: string;
  description: string;
  company_id: string;
}

export interface UpdateCategoryData {
  name?: string;
  description?: string;
}

export interface CreateDocumentData {
  category_id: string;
  title: string;
  content: string;
  item_type: ItemType;
  file_url?: string;
  file_type: FileType;
  file_size?: number;
  company_id: string;
}

export interface UpdateDocumentData {
  title?: string;
  content?: string;
  item_type?: ItemType;
  file_url?: string;
  file_type?: FileType;
  file_size?: number;
}

export interface KnowledgeTopic {
  id: string;
  company_id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTopicData {
  company_id: string;
  name: string;
  description: string;
}

export interface UpdateTopicData {
  name?: string;
  description?: string;
}

export interface KnowledgeQuestion {
  id: string;
  company_id: string;
  topic_id: string;
  question: string;
  answer: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  created_at: string;
  updated_at: string;
}

export interface RecommendationQuestion {
  id: string;
  company_id: string;
  question_text: string;
  expected_products: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  created_at: string;
  updated_at: string;
}
