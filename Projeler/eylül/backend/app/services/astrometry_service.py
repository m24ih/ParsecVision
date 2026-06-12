import os
from astroquery.astrometry_net import AstrometryNet


class AstrometryService:
    def __init__(self):
        self.api_key = os.getenv("ASTROMETRY_API_KEY")
        self.ast = AstrometryNet()

        if self.api_key:
            self.ast.api_key = self.api_key
        else:
            print(
                "WARNING: ASTROMETRY_API_KEY not found. Coordinate solving will be disabled."
            )

    def solve_image(self, file_path: str):
        if not self.api_key:
            return {"status": "error", "message": "API Key is missing."}

        try:
            print(
                f"[{file_path}] Sending to Astrometry.net. (This may take 1-3 minutes depending on star density...)"
            )

            wcs_header = self.ast.solve_from_image(file_path, force_image_upload=True)

            if wcs_header:
                ra = round(float(wcs_header.get("CRVAL1", 0.0)), 4)
                dec = round(float(wcs_header.get("CRVAL2", 0.0)), 4)

                print(f"Solve Successful! RA: {ra}, Dec: {dec}")
                return {"status": "success", "ra": ra, "dec": dec}
            else:
                return {
                    "status": "failed",
                    "message": "Solve failed. Not enough stars could be matched in the image.",
                }

        except Exception as e:
            return {"status": "error", "message": str(e)}
