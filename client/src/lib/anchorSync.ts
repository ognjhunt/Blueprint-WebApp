import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  setDoc,
  deleteDoc,
  getDoc,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  getStorage,
} from "firebase/storage";

import type { ARElement } from "@/types";

const storage = getStorage();

const uploadMediaToFirebase = async (
  file: File,
  blueprintId: string,
  anchorId: string,
): Promise<{ downloadUrl: string; storagePath: string }> => {
  const storagePath = `blueprints/${blueprintId}/anchors/${anchorId}/${file.name}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file);
  const downloadUrl = await getDownloadURL(storageRef);

  return { downloadUrl, storagePath };
};

export const createAnchorFromElement = async (
  element: ARElement,
  blueprintId: string,
  hostId: string,
  mediaFile?: File,
) => {
  const anchorId = `anchor-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const baseAnchorData = {
    id: anchorId,
    contentType: element.type,
    contentID: element.id,
    host: hostId,
    roomID: blueprintId,
    timeStamp: new Date(),
    date: new Date(),
    isPrivate: false,
    x: element.position.x,
    y: element.position.y,
    z: 0,
    title: element.content.title || "Untitled Element",
    description: element.content.description || "No description",
    trigger: element.content.trigger || "click",
  };

  if (element.type === "media") {
    let mediaData = {
      mediaUrl: "",
      storagePath: "",
      mediaType: element.content.mediaType || "image",
      width: element.content.width || undefined, // Add this
      height: element.content.height || undefined, // Add this
    };

    if (mediaFile) {
      const uploadResult = await uploadMediaToFirebase(
        mediaFile,
        blueprintId,
        anchorId,
      );
      mediaData = {
        mediaUrl: uploadResult.downloadUrl,
        storagePath: uploadResult.storagePath,
        mediaType: mediaFile.type.startsWith("video/") ? "video" : "image",
      };
    }

    return {
      ...baseAnchorData,
      ...mediaData,
    };
  } else if (element.type === "label") {
    return {
      ...baseAnchorData,
      textContent: element.content.title,
    };
  } else if (element.type === "infoCard") {
    return baseAnchorData;
  } else if (element.type === "marker") {
    return baseAnchorData;
  } else if (element.type === "interactive") {
    return baseAnchorData;
  } else {
    return baseAnchorData;
  }
};

export const syncElementWithFirebase = async (
  element: ARElement,
  blueprintId: string,
  hostId: string,
  mediaFile?: File,
) => {
  try {
    const anchorData = await createAnchorFromElement(
      element,
      blueprintId,
      hostId,
      mediaFile,
    );

    const anchorRef = doc(db, "anchors", anchorData.id);
    await setDoc(anchorRef, anchorData);

    const blueprintRef = doc(db, "blueprints", blueprintId);
    await updateDoc(blueprintRef, {
      anchorIDs: arrayUnion(anchorData.id),
    });

    return anchorData.id;
  } catch (error) {
    console.error("Error syncing element with Firebase:", error);
    throw error;
  }
};

export const updateAnchorInFirebase = async (
  element: ARElement,
  anchorId: string,
  blueprintId: string,
  newMediaFile?: File,
) => {
  try {
    const anchorRef = doc(db, "anchors", anchorId);

    const baseUpdateData = {
      contentType: element.type,
      contentID: element.id,
      x: element.position.x,
      y: element.position.y,
      z: 0,
      title: element.content.title || "Untitled Element",
      description: element.content.description || "No description",
      trigger: element.content.trigger || "click",
      timeStamp: new Date(),
    };

    if (element.type === "media") {
      let mediaData = {
        mediaUrl: element.content.mediaUrl || "",
        mediaType: element.content.mediaType || "image",
        storagePath: element.content.storagePath || "",
        width: element.content.width || undefined, // Add this
        height: element.content.height || undefined, // Add this
      };

      if (newMediaFile) {
        const uploadResult = await uploadMediaToFirebase(
          newMediaFile,
          blueprintId,
          anchorId,
        );
        // Preserve existing width and height if newMediaFile doesn't change them implicitly
        mediaData = {
          mediaUrl: uploadResult.downloadUrl,
          storagePath: uploadResult.storagePath,
          mediaType: newMediaFile.type.startsWith("video/") ? "video" : "image",
          width: mediaData.width, // Keep existing or undefined
          height: mediaData.height, // Keep existing or undefined
        };
      }

      await updateDoc(anchorRef, {
        ...baseUpdateData,
        ...mediaData,
      });
    } else if (element.type === "label") {
      await updateDoc(anchorRef, {
        ...baseUpdateData,
        textContent: element.content.title,
      });
    } else if (element.type === "marker") {
      await updateDoc(anchorRef, baseUpdateData);
    } else if (element.type === "interactive") {
      await updateDoc(anchorRef, baseUpdateData);
    } else if (element.type === "infoCard") {
      await updateDoc(anchorRef, baseUpdateData);
    } else {
      await updateDoc(anchorRef, baseUpdateData);
    }
  } catch (error) {
    console.error("Error updating anchor in Firebase:", error);
    throw error;
  }
};

export const deleteAnchorFromFirebase = async (
  anchorId: string,
  blueprintId: string,
) => {
  try {
    const anchorRef = doc(db, "anchors", anchorId);
    const anchorSnap = await getDoc(anchorRef);
    const anchorData = anchorSnap.data();

    if (anchorData?.storagePath) {
      const storageRef = ref(storage, anchorData.storagePath);
      try {
        await deleteObject(storageRef);
      } catch (error) {
        console.error("Error deleting media file:", error);
      }
    }

    await deleteDoc(anchorRef);

    const blueprintRef = doc(db, "blueprints", blueprintId);
    await updateDoc(blueprintRef, {
      anchorIDs: arrayRemove(anchorId),
    });
  } catch (error) {
    console.error("Error deleting anchor from Firebase:", error);
    throw error;
  }
};
