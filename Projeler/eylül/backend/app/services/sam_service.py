import numpy as np
import torch
import os
import cv2
import json
from segment_anything import sam_model_registry, SamPredictor

class SAMService:
    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model_type = "vit_h"
        self.checkpoint = "app/models/sam_vit_h_4b8939.pth"
        self.predictor = None

    def _init_predictor(self):
        if self.predictor is not None:
            return
        if not os.path.exists(self.checkpoint):
            print(f"CRITICAL: Checkpoint file not found at {self.checkpoint}")
            return
        sam = sam_model_registry[self.model_type](checkpoint=self.checkpoint)
        sam.to(device=self.device)
        self.predictor = SamPredictor(sam)

    def generate_mask(self, image_path, box_coords):
        if not self.predictor:
            raise Exception("SAM model is not initialized.")

        image = cv2.imread(image_path)
        if image is None:
            raise Exception(f"Could not load image at {image_path}")
            
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        self.predictor.set_image(image)

        input_box = np.array(box_coords)
        masks, _, _ = self.predictor.predict(
            point_coords=None,
            point_labels=None,
            box=input_box[None, :],
            multimask_output=False,
        )

        # SAM'in döndürdüğü maske boolean'dır, bunu JSON'a çevirmek için 0-1 integer yapıyoruz
        return json.dumps(masks[0].astype(np.uint8).tolist())