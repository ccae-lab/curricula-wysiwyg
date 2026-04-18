/**
 * Supabase Storage adapter — for image uploads.
 *
 * @param {Object} supabase — initialised Supabase client
 * @param {string} bucketName — e.g. 'content-images'
 *
 * @returns {import('../core/types').StorageAdapter}
 */
export function createSupabaseStorageAdapter(supabase, bucketName) {
  return {
    async uploadImage(file) {
      const ext = file.name.split('.').pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from(bucketName).upload(path, file);
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
      return data.publicUrl;
    },
  };
}
