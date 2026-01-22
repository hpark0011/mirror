import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/database.types";
import { FileInsert, FileRow } from "@/types/file.types";

export class FileService {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Upload a file to Supabase Storage and save metadata to database
   * @param file - The File object to upload
   * @param userId - The ID of the user uploading the file
   * @returns The created file record from the database
   */
  async uploadFile(file: File, userId: string): Promise<FileRow> {
    // Generate unique storage path with user ID prefix for RLS
    const fileExt = file.name.split(".").pop();
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const fileName = `${userId}/${timestamp}-${randomId}.${fileExt}`;

    // Upload to storage bucket
    const { error: storageError } = await this.supabase.storage
      .from("documents")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (storageError) {
      throw new Error(`Storage upload failed: ${storageError.message}`);
    }

    // Extract file name without extension for display
    const displayName = file.name.replace(/\.[^/.]+$/, "");

    // Store metadata in database
    const fileRecord: FileInsert = {
      user_id: userId,
      name: displayName,
      original_name: file.name,
      size: file.size,
      mime_type: file.type || null,
      storage_path: fileName,
      bucket_name: "documents",
    };

    const { data: fileData, error: dbError } = await this.supabase
      .from("files")
      .insert(fileRecord)
      .select()
      .single();

    if (dbError) {
      // Cleanup storage on database error
      await this.supabase.storage.from("documents").remove([fileName]);

      throw new Error(`Database insert failed: ${dbError.message}`);
    }

    if (!fileData) {
      // Cleanup storage if no data returned
      await this.supabase.storage.from("documents").remove([fileName]);

      throw new Error("Failed to create file record");
    }

    return fileData;
  }

  /**
   * Get all files for a specific user
   * @param userId - The ID of the user
   * @returns Array of file records
   */
  async getUserFiles(userId: string): Promise<FileRow[]> {
    const { data, error } = await this.supabase
      .from("files")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch files: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Delete a file from storage and database
   * @param fileId - The ID of the file to delete
   * @param userId - The ID of the user (for authorization)
   * @returns Success status
   */
  async deleteFile(
    fileId: string,
    userId: string
  ): Promise<{ success: boolean }> {
    // Get file details first (also serves as authorization check)
    const { data: file, error: fetchError } = await this.supabase
      .from("files")
      .select("storage_path")
      .eq("id", fileId)
      .eq("user_id", userId)
      .single();

    if (fetchError || !file) {
      throw new Error("File not found or unauthorized");
    }

    // Delete from storage first
    const { error: storageError } = await this.supabase.storage
      .from("documents")
      .remove([file.storage_path]);

    if (storageError) {
      throw new Error(`Storage deletion failed: ${storageError.message}`);
    }

    // Delete from database
    const { error: dbError } = await this.supabase
      .from("files")
      .delete()
      .eq("id", fileId)
      .eq("user_id", userId);

    if (dbError) {
      throw new Error(`Database deletion failed: ${dbError.message}`);
    }

    return { success: true };
  }

  /**
   * Get a signed URL for downloading a file
   * @param fileId - The ID of the file
   * @param userId - The ID of the user (for authorization)
   * @param expiresIn - URL expiration time in seconds (default 1 hour)
   * @returns Signed URL for file download
   */
  async getFileUrl(
    fileId: string,
    userId: string,
    expiresIn: number = 3600
  ): Promise<string> {
    // Get file details (also serves as authorization check)
    const { data: file, error } = await this.supabase
      .from("files")
      .select("storage_path, original_name")
      .eq("id", fileId)
      .eq("user_id", userId)
      .single();

    if (error || !file) {
      throw new Error("File not found or unauthorized");
    }

    // Generate signed URL
    const { data: urlData, error: urlError } = await this.supabase.storage
      .from("documents")
      .createSignedUrl(file.storage_path, expiresIn);

    if (urlError || !urlData) {
      throw new Error(`Failed to generate download URL: ${urlError?.message}`);
    }

    return urlData.signedUrl;
  }

  /**
   * Get file metadata by ID
   * @param fileId - The ID of the file
   * @param userId - The ID of the user (for authorization)
   * @returns File metadata
   */
  async getFile(fileId: string, userId: string): Promise<FileRow> {
    const { data, error } = await this.supabase
      .from("files")
      .select("*")
      .eq("id", fileId)
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      throw new Error("File not found or unauthorized");
    }

    return data;
  }

  /**
   * Get total storage usage for a user
   * @param userId - The ID of the user
   * @returns Total storage used in bytes
   */
  async getUserStorageUsage(userId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from("files")
      .select("size")
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to calculate storage usage: ${error.message}`);
    }

    return (data || []).reduce((total, file) => total + (file.size || 0), 0);
  }

  /**
   * Validate file before upload
   * @param file - The file to validate
   * @returns Validation result
   */
  validateFile(file: File): { valid: boolean; error?: string } {
    const MAX_FILE_SIZE = 52428800; // 50MB
    const ALLOWED_MIME_TYPES = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "image/jpeg",
      "image/png",
      "image/gif",
    ];

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File size exceeds 50MB limit (${Math.round(file.size / 1048576)}MB)`,
      };
    }

    // Check MIME type
    if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: `File type not allowed: ${file.type}`,
      };
    }

    return { valid: true };
  }
}
