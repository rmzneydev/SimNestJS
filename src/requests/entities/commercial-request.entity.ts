import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Status } from './status.entity.js';

@Entity('solicitudes')
export class CommercialRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  cliente: string;

  @Column('text')
  descripcion: string;

  @Column()
  asesor: string;

  @ManyToOne(() => Status, { eager: true, nullable: false })
  @JoinColumn({ name: 'estado_id' })
  estado: Status;

  @CreateDateColumn({ type: 'timestamptz' })
  creadaEn: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  actualizadaEn: Date;

}
