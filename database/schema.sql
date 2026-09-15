-- ============================================================
-- ODONTOLOGÍA INTEGRAL - ESQUEMA COMPLETO SUPABASE / POSTGRESQL
-- ============================================================
-- Ejecutar completo en: Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- Extensiones necesarias
create extension if not exists "uuid-ossp";
create extension if not exists btree_gist;

-- ============================================================
-- 1. PROFILES (usuarios del sistema, vinculado a auth.users)
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  email text not null unique,
  rol text not null default 'asistente' check (rol in ('administrador','odontologo','asistente')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- 2. ESPECIALIDADES
-- ============================================================
create table if not exists especialidades (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null unique,
  descripcion text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 3. ODONTÓLOGOS
-- ============================================================
create table if not exists odontologos (
  id uuid primary key default uuid_generate_v4(),
  nombres text not null,
  apellidos text not null,
  cedula text not null unique,
  telefono text,
  email text,
  especialidad_id uuid references especialidades(id) on delete set null,
  registro_profesional text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_odontologos_especialidad on odontologos(especialidad_id);

-- ============================================================
-- 4. SERVICIOS ODONTOLÓGICOS
-- ============================================================
create table if not exists servicios (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null,
  descripcion text,
  duracion_minutos integer not null check (duracion_minutos > 0),
  precio numeric(10,2) not null default 0 check (precio >= 0),
  especialidad_id uuid references especialidades(id) on delete set null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_servicios_especialidad on servicios(especialidad_id);

-- ============================================================
-- 5. HORARIOS (disponibilidad semanal por odontólogo)
-- ============================================================
create table if not exists horarios (
  id uuid primary key default uuid_generate_v4(),
  odontologo_id uuid not null references odontologos(id) on delete cascade,
  dia_semana integer not null check (dia_semana between 0 and 6), -- 0=Domingo ... 6=Sábado
  hora_inicio time not null,
  hora_fin time not null,
  activo boolean not null default true,
  constraint chk_horario_valido check (hora_fin > hora_inicio),
  unique (odontologo_id, dia_semana)
);

create index if not exists idx_horarios_odontologo on horarios(odontologo_id);

-- ============================================================
-- 6. PACIENTES
-- ============================================================
create table if not exists pacientes (
  id uuid primary key default uuid_generate_v4(),
  nombres text not null,
  apellidos text not null,
  cedula text not null unique,
  fecha_nacimiento date,
  sexo text check (sexo in ('M','F','Otro')),
  telefono text,
  email text,
  direccion text,
  contacto_emergencia text,
  telefono_emergencia text,
  alergias text,
  medicamentos text,
  antecedentes text,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pacientes_cedula on pacientes(cedula);
create index if not exists idx_pacientes_nombres on pacientes(nombres, apellidos);

-- ============================================================
-- 7. CITAS
-- ============================================================
create table if not exists citas (
  id uuid primary key default uuid_generate_v4(),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  odontologo_id uuid not null references odontologos(id) on delete cascade,
  servicio_id uuid not null references servicios(id) on delete restrict,
  fecha date not null,
  hora_inicio time not null,
  hora_fin time not null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente','confirmada','atendida','cancelada','no_asistio')),
  motivo text,
  observaciones text,
  precio numeric(10,2) default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_cita_horario_valido check (hora_fin > hora_inicio),
  -- Rango de tiempo generado para poder usar EXCLUDE con gist
  rango_tiempo tsrange generated always as (
    tsrange((fecha + hora_inicio)::timestamp, (fecha + hora_fin)::timestamp, '[)')
  ) stored
);

create index if not exists idx_citas_paciente on citas(paciente_id);
create index if not exists idx_citas_odontologo on citas(odontologo_id);
create index if not exists idx_citas_fecha on citas(fecha);

-- ------------------------------------------------------------
-- PROTECCIÓN DE CITAS SUPERPUESTAS A NIVEL DE POSTGRESQL
-- Un mismo odontólogo no puede tener dos citas activas
-- (no canceladas) cuyo rango de tiempo se superponga.
-- ------------------------------------------------------------
alter table citas
  add constraint no_citas_superpuestas
  exclude using gist (
    odontologo_id with =,
    rango_tiempo with &&
  )
  where (estado <> 'cancelada');

-- ============================================================
-- 8. TRATAMIENTOS
-- ============================================================
create table if not exists tratamientos (
  id uuid primary key default uuid_generate_v4(),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  odontologo_id uuid not null references odontologos(id) on delete set null,
  servicio_id uuid references servicios(id) on delete set null,
  pieza_dental text, -- ej: "36", puede ser null si no aplica a una pieza específica
  fecha_inicio date not null default current_date,
  fecha_fin date,
  estado text not null default 'planificado'
    check (estado in ('planificado','en_proceso','completado','cancelado')),
  precio_estimado numeric(10,2) default 0,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tratamientos_paciente on tratamientos(paciente_id);
create index if not exists idx_tratamientos_pieza on tratamientos(paciente_id, pieza_dental);

-- ============================================================
-- 9. ODONTOGRAMA (estado actual de cada pieza/superficie)
-- ============================================================
create table if not exists odontograma (
  id uuid primary key default uuid_generate_v4(),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  pieza_dental text not null, -- numeración FDI, ej "11".."48"
  superficie text not null
    check (superficie in ('mesial','distal','oclusal','incisal','vestibular','lingual_palatina','general')),
  estado text not null default 'sano'
    check (estado in ('sano','caries','restauracion','corona','endodoncia','ausente',
                       'extraccion_indicada','protesis','sellante','implante','otro')),
  observaciones text,
  odontologo_id uuid references odontologos(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (paciente_id, pieza_dental, superficie)
);

create index if not exists idx_odontograma_paciente on odontograma(paciente_id);

-- ============================================================
-- 10. HISTORIAL DEL ODONTOGRAMA (auditoría, nunca se sobrescribe)
-- ============================================================
create table if not exists odontograma_historial (
  id uuid primary key default uuid_generate_v4(),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  pieza_dental text not null,
  superficie text not null,
  estado_anterior text,
  estado_nuevo text not null,
  observaciones text,
  odontologo_id uuid references odontologos(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_odonto_hist_paciente on odontograma_historial(paciente_id);

-- ============================================================
-- TRIGGERS: updated_at automático
-- ============================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_pacientes_updated before update on pacientes
  for each row execute function set_updated_at();
create trigger trg_citas_updated before update on citas
  for each row execute function set_updated_at();
create trigger trg_tratamientos_updated before update on tratamientos
  for each row execute function set_updated_at();
create trigger trg_odontograma_updated before update on odontograma
  for each row execute function set_updated_at();

-- ============================================================
-- TRIGGER: registrar automáticamente cambios del odontograma
-- en el historial cada vez que se inserta o actualiza un estado
-- ============================================================
create or replace function log_odontograma_historial()
returns trigger language plpgsql as $$
begin
  if (TG_OP = 'INSERT') then
    insert into odontograma_historial
      (paciente_id, pieza_dental, superficie, estado_anterior, estado_nuevo, observaciones, odontologo_id)
    values
      (new.paciente_id, new.pieza_dental, new.superficie, null, new.estado, new.observaciones, new.odontologo_id);
  elsif (TG_OP = 'UPDATE' and old.estado is distinct from new.estado) then
    insert into odontograma_historial
      (paciente_id, pieza_dental, superficie, estado_anterior, estado_nuevo, observaciones, odontologo_id)
    values
      (new.paciente_id, new.pieza_dental, new.superficie, old.estado, new.estado, new.observaciones, new.odontologo_id);
  end if;
  return new;
end;
$$;

create trigger trg_odontograma_historial
  after insert or update on odontograma
  for each row execute function log_odontograma_historial();

-- ============================================================
-- TRIGGER: calcular hora_fin y precio automáticamente en citas
-- a partir de la duración/precio del servicio (si no vienen dados)
-- ============================================================
create or replace function calcular_datos_cita()
returns trigger language plpgsql as $$
declare
  v_duracion integer;
  v_precio numeric(10,2);
begin
  select duracion_minutos, precio into v_duracion, v_precio
  from servicios where id = new.servicio_id;

  if new.hora_fin is null then
    new.hora_fin := new.hora_inicio + (v_duracion || ' minutes')::interval;
  end if;

  if new.precio is null or new.precio = 0 then
    new.precio := v_precio;
  end if;

  return new;
end;
$$;

create trigger trg_calcular_cita before insert on citas
  for each row execute function calcular_datos_cita();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Todas las tablas clínicas/administrativas solo accesibles
-- para usuarios autenticados (personal del consultorio).
-- ============================================================
alter table profiles enable row level security;
alter table especialidades enable row level security;
alter table odontologos enable row level security;
alter table servicios enable row level security;
alter table horarios enable row level security;
alter table pacientes enable row level security;
alter table citas enable row level security;
alter table tratamientos enable row level security;
alter table odontograma enable row level security;
alter table odontograma_historial enable row level security;

-- profiles: cada usuario puede ver/editar su propio perfil
create policy "profiles_select_own" on profiles for select
  using (auth.uid() = id);
create policy "profiles_update_own" on profiles for update
  using (auth.uid() = id);

-- Política genérica reutilizable: cualquier usuario autenticado
-- puede leer y escribir (CRUD) en las tablas operativas.
-- (Se puede refinar por rol más adelante si se requiere.)
create policy "especialidades_all_auth" on especialidades
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "odontologos_all_auth" on odontologos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "servicios_all_auth" on servicios
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "horarios_all_auth" on horarios
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "pacientes_all_auth" on pacientes
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "citas_all_auth" on citas
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "tratamientos_all_auth" on tratamientos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "odontograma_all_auth" on odontograma
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "odontograma_historial_read_auth" on odontograma_historial
  for select using (auth.role() = 'authenticated');
create policy "odontograma_historial_insert_auth" on odontograma_historial
  for insert with check (auth.role() = 'authenticated');

-- ============================================================
-- TRIGGER: crear fila en profiles automáticamente al crear
-- un usuario en Supabase Auth (opcional pero recomendado)
-- ============================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, nombre, email, rol)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', new.email), new.email, 'administrador')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- DATOS INICIALES (especialidades base)
-- ============================================================
insert into especialidades (nombre, descripcion) values
  ('Odontología General','Atención odontológica general'),
  ('Ortodoncia','Corrección de la posición dental'),
  ('Endodoncia','Tratamiento de conductos'),
  ('Periodoncia','Tratamiento de encías'),
  ('Odontopediatría','Odontología infantil'),
  ('Cirugía Oral','Procedimientos quirúrgicos'),
  ('Rehabilitación Oral','Prótesis e implantes'),
  ('Estética Dental','Blanqueamiento y estética')
on conflict (nombre) do nothing;

-- ============================================================
-- FIN DEL ESQUEMA
-- ============================================================
