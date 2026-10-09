import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Estado } from './estado.entity.js';

@Entity('solicitudes')
export class Solicitud {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  cliente: string;

  @Column('text')
  descripcion: string;

  @Column()
  asesor: string;

  @ManyToOne(() => Estado, { eager: true, nullable: false })
  @JoinColumn({ name: 'estado_id' })
  estado: Estado;

  @CreateDateColumn()
  creadaEn: Date;

  @UpdateDateColumn()
  actualizadaEn: Date;
}
