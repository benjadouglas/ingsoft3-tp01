variable "image_repo_api" {
  default = "ghcr.io/benjadouglas/htmlplan-backend"
}

variable "image_repo_front" {
  default = "ghcr.io/benjadouglas/htmlplan-frontend"
}

# La imagen que está en PROD desde el TP7 (v7.0.0).
variable "image_tag" {
  default = "sha-d9cd3d407ebc04dcc27dde6b381fc5823a481ae5"
}

# La misma región que QA y PROD.
variable "region" {
  default = "virginia"
}

variable "neon_region" {
  default = "aws-us-east-1"
}
