import { storage } from "./firebase";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

/**
 * ImgDB сервис руу зураг хуулах үйлчилгээ
 * API-д хандах хэсэгт Firebase Storage-ийн оронд ImgDB API ашиглаж байна
 */

// ImgDB API-тай ажиллах функцүүд
const uploadToImgDB = async (file: File): Promise<string> => {
  try {
    // ImgDB API key
    const apiKey = process.env.NEXT_PUBLIC_IMGDB_API_KEY;

    if (!apiKey) {
      throw new Error("ImgDB API түлхүүр олдсонгүй");
    }

    // FormData үүсгэх
    const formData = new FormData();
    formData.append("image", file); // ImgDB шаардлага

    // Шууд API URL рүү шилжүүлэх
    const response = await fetch(
      `https://api.imgbb.com/1/upload?key=${apiKey}`,
      {
        method: "POST",
        body: formData,
        mode: "cors", // CORS тохируулга
      }
    );

    if (!response.ok) {
      throw new Error(`ImgDB хариу буцаалт алдаатай: ${response.status}`);
    }

    const result = await response.json();

    if (result && result.data && result.data.url) {
      console.log("ImgDB амжилттай хуулагдлаа:", result.data.url);
      return result.data.url;
    } else {
      throw new Error("ImgDB хариу буцаалт алдаатай бүтэцтэй");
    }
  } catch (error) {
    console.error("ImgDB-руу зураг хуулахад алдаа гарлаа:", error);
    throw error;
  }
};

// Дотоод санд түр хадгалах функц
const saveToLocalStorage = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();

      reader.onload = (event) => {
        if (event.target && typeof event.target.result === "string") {
          // Зургийг base64 кодоор хадгалах
          const key = `temp_img_${Date.now()}`;
          localStorage.setItem(key, event.target.result);
          resolve(key);
        } else {
          reject(new Error("Зургийг уншихад алдаа гарлаа"));
        }
      };

      reader.onerror = () => {
        reject(new Error("Зургийг уншихад алдаа гарлаа"));
      };

      reader.readAsDataURL(file);
    } catch (error) {
      reject(error);
    }
  });
};

// MAIN FUNCTIONS

// Зураг хуулах функц
export const uploadImage = async (
  file: File,
  path: string
): Promise<string> => {
  try {
    console.log("ImgDB руу зураг хуулж байна...");

    // Оптимизац хийсэн зургийг ImgDB руу хуулах
    const optimizedFile = await optimizeImage(file);
    return await uploadToImgDB(optimizedFile);
  } catch (error) {
    console.error("ImgDB руу зураг хуулахад алдаа гарлаа:", error);

    try {
      console.log("Алдаа гарсан тул дотоод санд зургийг хадгалж байна...");

      // Зургийг дотоод санд хадгалж, түлхүүрийг буцаах
      const storageKey = await saveToLocalStorage(file);

      // Буцаах URL нь зургийн түлхүүрийг агуулсан локал URL байна
      // Ингэснээр дотоод сангаас авах боломжтой болно
      return `local://${storageKey}`;
    } catch (localError) {
      console.error("Дотоод санд хадгалахад алдаа гарлаа:", localError);
      throw new Error("Зураг хадгалах боломжгүй байна");
    }
  }
};

// Дотоод сангаас зураг авах функц (компонентуудад ашиглахад зориулсан)
export const getImageFromStorage = (url: string): string => {
  if (url.startsWith("local://")) {
    const key = url.replace("local://", "");
    const dataUrl = localStorage.getItem(key);
    return dataUrl || "/placeholder.svg";
  }
  return url;
};

// Зураг устгах функц
export const deleteImage = async (path: string): Promise<boolean> => {
  try {
    // Локал URL-ээс эхлэдэг бол дотоод сангаас устгах
    if (path.startsWith("local://")) {
      const key = path.replace("local://", "");
      localStorage.removeItem(key);
      console.log(`Дотоод сангаас зураг амжилттай устгагдлаа: ${key}`);
      return true;
    }

    // Бусад тохиолдолд огноргох (мэдээллийн санд URL хадгалагдсан ч устгах боломжгүй)
    console.log("Зураг сервер дээр байгаа тул устгах боломжгүй: " + path);
    return true;
  } catch (error) {
    console.error("Зураг устгахад алдаа гарлаа:", error);
    return false;
  }
};

// Зургийн оптимизац хийх функц
export const optimizeImage = async (file: File): Promise<File> => {
  try {
    // Зургийн хэмжээг шалгах
    if (file.size > 1024 * 1024 * 2) {
      // 2MB-с их
      console.log("Зургийн хэмжээ хэтэрсэн тул шахаж байна...");

      // Canvas ашиглан зургийн хэмжээг багасгах
      const image = new Image();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = URL.createObjectURL(file);
      });

      // Зургийн хэмжээг тодорхойлох
      let width = image.width;
      let height = image.height;

      // Зургийн хэмжээг багасгах харьцаа
      const MAX_WIDTH = 1200;
      const MAX_HEIGHT = 1200;

      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        if (width > height) {
          height = Math.round(height * (MAX_WIDTH / width));
          width = MAX_WIDTH;
        } else {
          width = Math.round(width * (MAX_HEIGHT / height));
          height = MAX_HEIGHT;
        }
      }

      // Canvas-д зургийг зурах
      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(image, 0, 0, width, height);

      // Canvas-ийг blob болгож хувиргах
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), "image/jpeg", 0.8);
      });

      // Blob-ийг File болгож хувиргах
      const optimizedFile = new File(
        [blob],
        file.name.replace(/\.[^.]+$/, ".jpg"),
        { type: "image/jpeg" }
      );

      console.log(
        `Зургийн хэмжээ багассан: ${file.size} => ${optimizedFile.size} байт`
      );
      return optimizedFile;
    }

    return file;
  } catch (error) {
    console.error("Зургийн оптимизац хийхэд алдаа гарлаа:", error);
    return file; // Алдаа гарсан тохиолдолд оригинал зураг буцаана
  }
};
