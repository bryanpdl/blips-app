import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

export async function uploadImage(file: File, folder: string): Promise<string> {
  const filename = `${Date.now()}-${file.name}`;
  const storageRef = ref(storage, `${folder}/${filename}`);
  
  await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(storageRef);
  
  return downloadURL;
} 