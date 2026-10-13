import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Status } from './status.entity.js';

@Entity('solicitudes')
@Index(['estado'])
@Index(['asesor'])
@Index(['creadaEn'])
export class CommercialRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  cliente: string;

  @Column('text')
  descripcion: string;

  @Column({ nullable: true })
  asesor: string | null;

  @Column({ type: 'int', default: 1 })
  version: number;

  @ManyToOne(() => Status, { eager: true, nullable: false })
  @JoinColumn({ name: 'estado_id' })
  estado: Status;

  @CreateDateColumn({ type: 'timestamptz' })
  creadaEn: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  actualizadaEn: Date;

}
