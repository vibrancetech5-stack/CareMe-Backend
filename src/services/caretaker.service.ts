import { supabase } from '../config/supabase.js';

export class CaretakerService {
  async createCaretaker(payload: any) {
    const { data, error } =
      await supabase
        .from('caretakers')
        .insert(payload)
        .select()
        .single();

    if (error) throw new Error(error.message);

    return data;
  }
}
