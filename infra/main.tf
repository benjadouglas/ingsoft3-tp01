terraform {
  required_version = ">= 1.5"

  required_providers {
    neon = {
      source  = "kislerdm/neon"
      version = "0.18.0"
    }
    render = {
      source  = "render-oss/render"
      version = "1.9.1"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.7.2"
    }
  }
}

provider "neon" {}   # lee NEON_API_KEY
provider "render" {} # lee RENDER_API_KEY y RENDER_OWNER_ID

# --- La base de preprod: un proyecto de Neon propio, aparte del de QA y PROD ---

resource "neon_project" "preprod" {
  name      = "htmlplan-preprod"
  region_id = var.neon_region

  # El provider pide un día de historial y el plan gratuito permite seis horas.
  history_retention_seconds = 21600
}

resource "neon_role" "preprod" {
  project_id = neon_project.preprod.id
  branch_id  = neon_project.preprod.default_branch_id
  name       = "plans"
}

resource "neon_database" "preprod" {
  project_id = neon_project.preprod.id
  branch_id  = neon_project.preprod.default_branch_id
  name       = "app_preprod"
  owner_name = neon_role.preprod.name
}

# El secreto de las sesiones también nace acá: no lo escribe nadie.
resource "random_password" "auth_secret" {
  length  = 48
  special = false
}

# --- Los servicios de preprod: la imagen que el TP7 promovió a PROD ---

locals {
  # La cadena de conexión se arma con lo que devolvió Neon; no se copia de ningún lado.
  database_url = "postgres://${neon_role.preprod.name}:${urlencode(neon_role.preprod.password)}@${neon_project.preprod.database_host}/${neon_database.preprod.name}?sslmode=require"
}

resource "render_web_service" "api" {
  name   = "htmlplan-api-preprod"
  plan   = "free"
  region = var.region

  runtime_source = {
    image = {
      image_url = var.image_repo_api
      tag       = var.image_tag
    }
  }

  # Sin COMMIT: lo trae la imagen y /api/health lo devuelve.
  env_vars = {
    DATABASE_URL       = { value = local.database_url }
    BETTER_AUTH_SECRET = { value = random_password.auth_secret.result }
  }
}

resource "render_web_service" "front" {
  name   = "htmlplan-front-preprod"
  plan   = "free"
  region = var.region

  runtime_source = {
    image = {
      image_url = var.image_repo_front
      tag       = var.image_tag
    }
  }

  env_vars = {
    # La api de ESTE entorno, sacada de su propio recurso.
    BACKEND_URL  = { value = render_web_service.api.url }
    DNS_RESOLVER = { value = "8.8.8.8" }
  }
}
